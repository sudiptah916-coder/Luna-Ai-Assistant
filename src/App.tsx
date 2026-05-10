import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2 } from "lucide-react";
import { getLunaResponse, getLunaAudio, resetLunaSession } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import Visualizer from "./components/Visualizer";
import PermissionModal from "./components/PermissionModal";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";

type AppState = "idle" | "listening" | "processing" | "speaking";

interface ChatMessage {
  id: string;
  sender: "user" | "luna";
  text: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("luna_chat_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    return [];
  });
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem("luna_chat_history", JSON.stringify(messages));
  }, [messages]);

  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [permissionError, setPermissionError] = useState<string>("blocked");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  const handleTextCommand = useCallback(async (finalTranscript: string) => {
    if (!finalTranscript.trim()) {
      setAppState("idle");
      return;
    }

    setMessages((prev) => [...prev, { id: Date.now().toString(), sender: "user", text: finalTranscript }]);
    
    // If live session is active, send text through it
    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.sendText(finalTranscript);
      return;
    }

    setAppState("processing");

    // 1. Check for browser commands
    const commandResult = processCommand(finalTranscript);

    let responseText = "";

    if (commandResult.isBrowserAction) {
      responseText = commandResult.action;
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-l", sender: "luna", text: responseText }]);
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getLunaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }

      setAppState("idle");

      setTimeout(() => {
        if (commandResult.url) {
          window.open(commandResult.url, "_blank");
        }
      }, 1500);
    } else {
      // 2. General Chit-Chat via Gemini
      responseText = await getLunaResponse(finalTranscript, messagesRef.current);
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-l", sender: "luna", text: responseText }]);
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getLunaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }
      setAppState("idle");
    }
  }, [isMuted, isSessionActive]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      resetLunaSession();
    } else {
      try {
        setIsSessionActive(true);
        resetLunaSession();
        
        const session = new LiveSessionManager();
        session.isMuted = isMuted;
        liveSessionRef.current = session;
        
        session.onStateChange = (state) => {
          setAppState(state);
        };
        
        session.onMessage = (sender, text) => {
          setMessages((prev) => [...prev, { id: Date.now().toString() + "-" + sender, sender, text }]);
        };
        
        session.onCommand = (url) => {
          setTimeout(() => {
            window.open(url, "_blank");
          }, 1000);
        };

        await session.start();
      } catch (e: any) {
        console.error("Failed to start session", e);
        if (e?.name === 'NotFoundError' || e?.message?.toLowerCase().includes('device not found')) {
            setPermissionError('notfound');
        } else {
            setPermissionError('blocked');
        }
        setShowPermissionModal(true);
        setIsSessionActive(false);
        setAppState("idle");
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    
    handleTextCommand(textInput);
    setTextInput("");
    setShowTextInput(false);
  };

  return (
    <div className="h-[100dvh] w-screen bg-[#000000] text-white flex flex-col items-center justify-between font-sans relative overflow-hidden m-0 p-0 selection:bg-white/20">
      {showPermissionModal && (
        <PermissionModal 
          onClose={() => setShowPermissionModal(false)} 
          errorType={permissionError}
        />
      )}

      {/* Modern MacOS / VisionOS Ambient Background */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] justify-center left-[-10%] w-[60%] h-[60%] bg-indigo-600/40 blur-[130px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-pink-500/30 blur-[140px] rounded-full mix-blend-screen" />
        <div className="absolute top-[30%] left-[50%] w-[50%] h-[50%] bg-sky-500/20 blur-[150px] rounded-full mix-blend-screen" />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[100px]" />
      </div>

      {/* Floating Header */}
      <header className="absolute top-6 left-0 w-full flex justify-center z-30 pointer-events-none px-6">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="glass-pill rounded-full px-5 py-2.5 flex items-center justify-between w-full max-w-5xl pointer-events-auto"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center font-bold text-sm shadow-[0_0_15px_rgba(99,102,241,0.5)]">
              L
            </div>
            <h1 className="text-base font-medium tracking-wide text-white/90">Luna</h1>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => {
                  if (confirm("Clear chat history?")) {
                    setMessages([]);
                    resetLunaSession();
                  }
                }}
                className="w-9 h-9 flex items-center justify-center rounded-full glass-button hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all"
                title="Clear Chat History"
              >
                <Trash2 size={16} className="opacity-80" />
              </button>
            )}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="w-9 h-9 flex items-center justify-center rounded-full glass-button transition-all"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX size={16} className="opacity-80" />
              ) : (
                <Volume2 size={16} className="opacity-80" />
              )}
            </button>
          </div>
        </motion.div>
      </header>

      {/* Main Content Layout */}
      <main className="absolute inset-0 flex flex-col items-center justify-center w-full h-full z-10 pt-24 pb-48 pointer-events-none">
        
        {/* Visualizer - Center Stage */}
        <div className="flex-1 flex items-center justify-center w-full z-0 relative">
          <Visualizer state={appState} />
        </div>

        {/* Dynamic State Indicator */}
        <AnimatePresence>
          {appState !== "idle" && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute top-28 xl:top-32 left-1/2 -translate-x-1/2 z-20 glass-pill px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase flex items-center gap-2 text-white/80"
            >
              {appState === "listening" && <><span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse shadow-[0_0_8px_rgba(244,114,182,0.8)]" /> Listening</>}
              {appState === "processing" && <><Loader2 size={12} className="animate-spin text-sky-400" /> Thinking</>}
              {appState === "speaking" && <><span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.8)]" /> Speaking</>}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Floating Chat History */}
        <div className="absolute inset-x-0 bottom-36 xl:bottom-40 flex justify-center w-full pointer-events-none px-4">
          <div className="w-full max-w-2xl flex flex-col justify-end">
            <AnimatePresence>
              {messages.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-panel w-full rounded-[2rem] p-5 h-[35vh] min-h-[250px] max-h-[400px] flex flex-col pointer-events-auto border-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
                >
                  <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-4 pr-2">
                    {messages.map((msg) => (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={msg.id}
                        className={`flex flex-col max-w-[85%] ${
                          msg.sender === "user" ? "self-end items-end" : "self-start items-start"
                        }`}
                      >
                        <span className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-1 ml-1 mr-1">
                          {msg.sender === "user" ? "You" : "Luna"}
                        </span>
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm filter drop-shadow-md ${
                            msg.sender === "user"
                              ? "bg-white/10 text-white border border-white/10 rounded-tr-sm backdrop-blur-md"
                              : "bg-gradient-to-br from-indigo-500/20 to-pink-500/20 text-white border border-white/10 rounded-tl-sm backdrop-blur-md"
                          }`}
                        >
                          {msg.text}
                        </div>
                      </motion.div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Floating Control Center (Dock) */}
      <footer className="absolute bottom-8 left-0 w-full flex flex-col items-center justify-center z-30 pointer-events-none px-4 gap-4">
        
        {/* Dynamic Text Input */}
        <AnimatePresence>
          {showTextInput && (
            <motion.form 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              onSubmit={handleTextSubmit}
              className="w-full max-w-md flex items-center gap-2 glass-panel rounded-full p-1.5 pl-5 pointer-events-auto shadow-2xl border-white/20"
            >
              <input 
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Message Luna..."
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/40 text-[15px]"
                autoFocus
              />
              <button 
                type="submit"
                disabled={!textInput.trim()}
                className="w-9 h-9 flex justify-center items-center rounded-full bg-white text-black disabled:bg-white/20 disabled:text-white/40 transition-colors"
              >
                <Send size={16} className="-ml-0.5" />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Main Dock */}
        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 glass-pill p-2 rounded-full pointer-events-auto border border-white/20 shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
        >
          {/* Main Action Button */}
          <button
            onClick={toggleListening}
            className={`
              group relative flex items-center justify-center w-14 h-14 rounded-full transition-all duration-500 ease-out overflow-hidden
              ${
                isSessionActive
                  ? "bg-red-500/80 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:bg-red-400"
                  : "bg-white text-black hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              }
            `}
          >
            {isSessionActive ? (
              <MicOff size={22} className="relative z-10" />
            ) : (
              <Mic size={22} className="relative z-10 group-hover:scale-110 transition-transform duration-300" />
            )}
            {!isSessionActive && (
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-100 to-pink-100 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            )}
          </button>
          
          {/* Keyboard Toggle */}
          <AnimatePresence>
            {!isSessionActive && (
              <motion.button
                initial={{ width: 0, opacity: 0, margin: 0 }}
                animate={{ width: 56, opacity: 1, marginLeft: 0 }}
                exit={{ width: 0, opacity: 0, margin: 0 }}
                onClick={() => setShowTextInput(!showTextInput)}
                className="flex items-center justify-center w-14 h-14 rounded-full glass-button hover:bg-white/10"
                title="Type message"
              >
                <Keyboard size={20} className="opacity-80" />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      </footer>
    </div>
  );
}
