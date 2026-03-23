"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bot,
  Send,
  Plus,
  Copy,
  Check,
  Sparkles,
  MessageSquare,
  Trash2,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/hooks/use-toast"

// ─── Types ───────────────────────────────────────────────────────────────────

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
}

type Conversation = {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "kingcrm-ai-chats"

const SUGGESTED_PROMPTS = [
  { label: "Draft a follow-up SMS", prompt: "Write a short, high-converting follow-up SMS for a qualified lead who hasn't responded in 3 days. Keep it personal and direct." },
  { label: "Qualify a new lead", prompt: "Give me a quick qualification framework for insurance leads. What are the top 5 questions to ask on the first call?" },
  { label: "Identify deals at risk", prompt: "What are the warning signs that a pipeline deal is going cold? How do I re-engage fast?" },
  { label: "Write a cold email", prompt: "Write a cold outreach email to a small business owner about key person insurance. Make it compelling, under 150 words." },
  { label: "Objection handling", prompt: "Give me the 3 most common insurance sales objections and elite responses for each one." },
  { label: "Medicare pitch script", prompt: "Give me a 60-second call opening script for Medicare Advantage leads aged 64-67." },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function newConversation(): Conversation {
  const now = new Date().toISOString()
  return { id: genId(), title: "New conversation", messages: [], createdAt: now, updatedAt: now }
}

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Conversation[]) : []
  } catch {
    return []
  }
}

function saveConversations(convos: Conversation[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convos))
  } catch { /* ignore */ }
}

// ─── TypingDots ───────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-[#2563EB]"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  )
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user"

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex items-start gap-3 group", isUser && "flex-row-reverse")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
          isUser ? "bg-[#2563EB]" : "bg-[#0F172A]"
        )}
      >
        {isUser ? (
          <span className="text-xs font-bold text-white">U</span>
        ) : (
          <Bot className="w-4 h-4 text-[#2563EB]" />
        )}
      </div>

      {/* Bubble */}
      <div className={cn("flex flex-col gap-1 max-w-[75%]", isUser && "items-end")}>
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
            isUser
              ? "bg-[#2563EB] text-white rounded-tr-sm"
              : "bg-white border border-[#D7DFEA] text-gray-800 rounded-tl-sm shadow-sm"
          )}
        >
          {message.content}
        </div>
        <div className={cn("flex items-center gap-1", isUser && "flex-row-reverse")}>
          <span className="text-xs text-gray-400">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {!isUser && <CopyButton text={message.content} />}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function AiAssistantView() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadConversations()
    if (saved.length > 0) {
      setConversations(saved)
      setActiveChatId(saved[0].id)
    } else {
      const fresh = newConversation()
      setConversations([fresh])
      setActiveChatId(fresh.id)
    }
  }, [])

  // Persist on change
  useEffect(() => {
    if (conversations.length > 0) saveConversations(conversations)
  }, [conversations])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeChatId, streamingContent, streaming])

  const activeChat = conversations.find((c) => c.id === activeChatId) ?? null

  const createNewChat = useCallback(() => {
    const fresh = newConversation()
    setConversations((prev) => [fresh, ...prev])
    setActiveChatId(fresh.id)
    setInput("")
  }, [])

  const deleteChat = useCallback((id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id)
      if (activeChatId === id) {
        if (next.length > 0) setActiveChatId(next[0].id)
        else {
          const fresh = newConversation()
          setActiveChatId(fresh.id)
          return [fresh]
        }
      }
      return next
    })
  }, [activeChatId])

  const sendMessage = useCallback(async (content: string) => {
    const text = content.trim()
    if (!text || streaming) return

    // Abort any existing stream
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const userMsg: Message = {
      id: genId(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    }

    // Add user message + update title if first message
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeChatId) return c
        const isFirst = c.messages.length === 0
        return {
          ...c,
          title: isFirst ? text.slice(0, 42) + (text.length > 42 ? "…" : "") : c.title,
          messages: [...c.messages, userMsg],
          updatedAt: new Date().toISOString(),
        }
      })
    )

    setInput("")
    setStreaming(true)
    setStreamingContent("")

    try {
      const currentMessages = activeChat?.messages ?? []
      const apiMessages = [...currentMessages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6).trim()
          if (data === "[DONE]") continue
          try {
            const parsed = JSON.parse(data) as { content?: string }
            if (parsed.content) {
              accumulated += parsed.content
              setStreamingContent(accumulated)
            }
          } catch { /* malformed chunk */ }
        }
      }

      // Commit the full AI message
      const aiMsg: Message = {
        id: genId(),
        role: "assistant",
        content: accumulated,
        createdAt: new Date().toISOString(),
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeChatId
            ? { ...c, messages: [...c.messages, aiMsg], updatedAt: new Date().toISOString() }
            : c
        )
      )
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return
      toast({
        title: "AI response failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setStreaming(false)
      setStreamingContent("")
    }
  }, [activeChat, activeChatId, streaming])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      void sendMessage(input)
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[#F5F7FB] overflow-hidden">
      {/* ── Sidebar: conversation list ── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-[#D7DFEA] bg-white">
        {/* Header */}
        <div className="p-4 border-b border-[#D7DFEA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center">
              <Bot className="w-4 h-4 text-[#2563EB]" />
            </div>
            <span className="font-semibold text-black text-sm">AI Assistant</span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="w-8 h-8 text-gray-400 hover:text-[#2563EB] hover:bg-[#EEF2F7]"
            onClick={createNewChat}
            title="New chat"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {conversations.map((convo) => (
              <button
                key={convo.id}
                onClick={() => setActiveChatId(convo.id)}
                className={cn(
                  "w-full group flex items-start gap-2 rounded-lg px-3 py-2.5 text-left transition-colors",
                  activeChatId === convo.id
                    ? "bg-[#EEF2F7] text-black"
                    : "text-gray-600 hover:bg-[#F5F7FB] hover:text-black"
                )}
              >
                <MessageSquare className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate leading-snug">{convo.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {new Date(convo.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                    {convo.messages.length > 0 && ` · ${convo.messages.length} msg${convo.messages.length > 1 ? "s" : ""}`}
                  </p>
                </div>
                {activeChatId === convo.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteChat(convo.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 hover:text-red-500 text-gray-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Footer hint */}
        <div className="p-3 border-t border-[#D7DFEA]">
          <p className="text-[11px] text-gray-400 text-center">⌘ + Enter to send</p>
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeChat && (
          <>
            {/* Chat header */}
            <div className="px-6 py-4 border-b border-[#D7DFEA] bg-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#14B8A6] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-black text-sm">
                  {activeChat.title === "New conversation" ? "AI Sales Assistant" : activeChat.title}
                </h2>
                <p className="text-xs text-gray-400">AI-powered · King CRM</p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-6 py-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Empty state */}
                {activeChat.messages.length === 0 && !streaming && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-10"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#14B8A6] flex items-center justify-center mx-auto mb-4">
                      <Bot className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-black">How can I help you close?</h3>
                    <p className="text-gray-500 text-sm mt-2 mb-8">
                      Ask me anything — lead qualification, follow-up scripts, objections, pipeline strategy.
                    </p>

                    {/* Suggested prompts grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-left">
                      {SUGGESTED_PROMPTS.map((sp) => (
                        <button
                          key={sp.label}
                          onClick={() => void sendMessage(sp.prompt)}
                          className="p-4 bg-white border border-[#D7DFEA] rounded-xl text-left hover:border-[#2563EB] hover:shadow-sm transition-all group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-black">{sp.label}</p>
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#2563EB] shrink-0 mt-0.5 transition-colors" />
                          </div>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{sp.prompt}</p>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Message history */}
                <AnimatePresence>
                  {activeChat.messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                </AnimatePresence>

                {/* Streaming in-progress */}
                {streaming && (
                  <>
                    {streamingContent ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-3"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="w-4 h-4 text-[#2563EB]" />
                        </div>
                        <div className="max-w-[75%] px-4 py-3 bg-white border border-[#D7DFEA] rounded-2xl rounded-tl-sm shadow-sm text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                          {streamingContent}
                          <span className="inline-block w-1.5 h-4 bg-[#2563EB] ml-0.5 animate-pulse rounded-sm" />
                        </div>
                      </motion.div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-[#2563EB]" />
                        </div>
                        <div className="bg-white border border-[#D7DFEA] rounded-2xl rounded-tl-sm shadow-sm">
                          <TypingDots />
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="px-6 py-4 border-t border-[#D7DFEA] bg-white">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-end gap-3 bg-[#EEF2F7] rounded-2xl border border-[#D7DFEA] px-4 py-3 focus-within:border-[#2563EB] transition-colors">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about leads, scripts, pipeline strategy…"
                    className="flex-1 bg-transparent border-none shadow-none resize-none text-sm text-black placeholder:text-gray-400 min-h-[36px] max-h-[160px] p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    rows={1}
                    disabled={streaming}
                  />
                  <Button
                    size="icon"
                    className={cn(
                      "w-9 h-9 rounded-xl shrink-0 transition-all",
                      input.trim() && !streaming
                        ? "bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-sm"
                        : "bg-[#D7DFEA] text-gray-400 cursor-not-allowed"
                    )}
                    disabled={!input.trim() || streaming}
                    onClick={() => void sendMessage(input)}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-gray-400 mt-2 text-center">
                  AI can make mistakes. Verify before sending to clients.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
