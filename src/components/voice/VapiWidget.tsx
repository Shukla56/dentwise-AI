"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { vapi } from "@/lib/vapi";

// Define the shape of a message
interface Message {
  content: string;
  role: "assistant" | "user";
}

function VapiWidget() {
  const [callActive, setCallActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [callEnded, setCallEnded] = useState(false);

  const { user, isLoaded } = useUser();
  const messageContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Setup VAPI event listeners
  useEffect(() => {
    const handleCallStart = () => {
      console.log("Call started");
      setConnecting(false);
      setCallActive(true);
      setCallEnded(false);
    };

    const handleCallEnd = () => {
      console.log("Call ended");
      setCallActive(false);
      setConnecting(false);
      setIsSpeaking(false);
      setCallEnded(true);
    };

    const handleSpeechStart = () => setIsSpeaking(true);
    const handleSpeechEnd = () => setIsSpeaking(false);

    const handleMessage = (message: any) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        setMessages((prev) => [
          ...prev,
          { content: message.transcript, role: message.role },
        ]);
      }
    };

    const handleError = (error: any) => {
      console.error("VAPI Error:", error);
      setConnecting(false);
      setCallActive(false);
    };

    vapi
      .on("call-start", handleCallStart)
      .on("call-end", handleCallEnd)
      .on("speech-start", handleSpeechStart)
      .on("speech-end", handleSpeechEnd)
      .on("message", handleMessage)
      .on("error", handleError);

    // Cleanup
    return () => {
      vapi
        .off("call-start", handleCallStart)
        .off("call-end", handleCallEnd)
        .off("speech-start", handleSpeechStart)
        .off("speech-end", handleSpeechEnd)
        .off("message", handleMessage)
        .off("error", handleError);
    };
  }, []);

  // Handle call start/stop
  const toggleCall = async () => {
    if (callActive) {
      vapi.stop();
      return;
    }

    try {
      setConnecting(true);
      setMessages([]);
      setCallEnded(false);

      const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
      if (!assistantId) {
        console.error("VAPI Assistant ID is missing");
        setConnecting(false);
        return;
      }

      await vapi.start(assistantId);
    } catch (error) {
      console.error("Failed to start call", error);
      setConnecting(false);
    }
  };

  if (!isLoaded) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 flex flex-col overflow-hidden pb-20">
      {/* TITLE */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold font-mono">
          <span>Talk to Your </span>
          <span className="text-primary uppercase">AI Dental Assistant</span>
        </h1>
        <p className="text-muted-foreground mt-2">
          Have a voice conversation with our AI assistant for dental advice and guidance
        </p>
      </div>

      {/* VIDEO CALL AREA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* AI ASSISTANT CARD */}
        <Card className="bg-card/90 backdrop-blur-sm border border-border overflow-hidden relative">
          <div className="aspect-video flex flex-col items-center justify-center p-6 relative">
            {/* AI Speaking Animation */}
            <div
              className={`absolute inset-0 ${
                isSpeaking ? "opacity-30" : "opacity-0"
              } transition-opacity duration-300`}
            >
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex justify-center items-center h-20">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`mx-1 h-16 w-1 bg-primary rounded-full ${
                      isSpeaking ? "animate-sound-wave" : ""
                    }`}
                    style={{
                      animationDelay: `${i * 0.1}s`,
                      height: isSpeaking ? `${Math.random() * 50 + 20}%` : "5%",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* AI LOGO */}
            <div className="relative size-32 mb-4">
              <div
                className={`absolute inset-0 bg-primary opacity-10 rounded-full blur-lg ${
                  isSpeaking ? "animate-pulse" : ""
                }`}
              />
              <div className="relative w-full h-full rounded-full bg-card flex items-center justify-center border border-border overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-primary/5"></div>
                <Image
                  src="/logo.png"
                  alt="AI Dental Assistant"
                  width={80}
                  height={80}
                  className="w-20 h-20 object-contain"
                />
              </div>
            </div>

            <h2 className="text-xl font-bold text-foreground">DentWise AI</h2>
            <p className="text-sm text-muted-foreground mt-1">Dental Assistant</p>

            {/* Speaking Status */}
            <div
              className={`mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border ${
                isSpeaking ? "border-primary" : ""
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isSpeaking ? "bg-primary animate-pulse" : "bg-muted"
                }`}
              />
              <span className="text-xs text-muted-foreground">
                {isSpeaking
                  ? "Speaking..."
                  : callActive
                  ? "Listening..."
                  : callEnded
                  ? "Call ended"
                  : "Waiting..."}
              </span>
            </div>
          </div>
        </Card>

        {/* USER CARD */}
        <Card className="bg-card/90 backdrop-blur-sm border overflow-hidden relative">
          <div className="aspect-video flex flex-col items-center justify-center p-6 relative">
            <div className="relative size-32 mb-4">
              <Image
                src={user?.imageUrl || "/default-user.png"}
                alt="User"
                width={128}
                height={128}
                className="size-full object-cover rounded-full"
              />
            </div>
            <h2 className="text-xl font-bold text-foreground">You</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "Guest"}
            </p>
            <div className="mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-card border">
              <div className="w-2 h-2 rounded-full bg-muted" />
              <span className="text-xs text-muted-foreground">Ready</span>
            </div>
          </div>
        </Card>
      </div>

      {/* MESSAGES */}
      {messages.length > 0 && (
        <div
          ref={messageContainerRef}
          className="w-full bg-card/90 backdrop-blur-sm border border-border rounded-xl p-4 mb-8 h-64 overflow-y-auto scroll-smooth"
        >
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className="animate-in fade-in">
                <div className="font-semibold text-xs text-muted-foreground mb-1">
                  {msg.role === "assistant" ? "DentWise AI" : "You"}:
                </div>
                <p className="text-foreground">{msg.content}</p>
              </div>
            ))}
            {callEnded && (
              <div className="animate-in fade-in">
                <div className="font-semibold text-xs text-primary mb-1">System:</div>
                <p className="text-foreground">
                  Call ended. Thank you for using DentWise AI!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CALL BUTTON */}
      <div className="flex justify-center">
        <Button
          className={`w-44 text-xl rounded-3xl ${
            callActive
              ? "bg-destructive hover:bg-destructive/90"
              : callEnded
              ? "bg-red-500 hover:bg-red-700"
              : "bg-primary hover:bg-primary/90"
          } text-white relative`}
          onClick={toggleCall}
          disabled={connecting}
        >
          {connecting && (
            <span className="absolute inset-0 rounded-full animate-ping bg-primary/50 opacity-75" />
          )}
          {callActive
            ? "End Call"
            : connecting
            ? "Connecting..."
            : callEnded
            ? "Call Ended"
            : "Start Call"}
        </Button>
      </div>
    </div>
  );
}

export default VapiWidget;
