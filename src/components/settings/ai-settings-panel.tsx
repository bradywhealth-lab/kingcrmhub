'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Bot,
  Check,
  Eye,
  EyeOff,
  Key,
  RefreshCw,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/hooks/use-toast'

type ProviderInfo = {
  id: string
  label: string
  defaultModel: string
  requiresKey: boolean
}

type AISettings = {
  provider: string
  model: string
  hasKey: boolean
  maskedKey: string | null
  providerLabel: string
  availableProviders: ProviderInfo[]
}

export function AISettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<AISettings | null>(null)
  const [selectedProvider, setSelectedProvider] = useState('groq')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/ai')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSettings(data)
      setSelectedProvider(data.provider)
    } catch (error) {
      toast({
        title: 'Failed to load AI settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const saveProvider = async (provider: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/ai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiProvider: provider }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'AI provider updated', description: `Switched to ${data.providerLabel}` })
      setSelectedProvider(provider)
      await loadSettings()
    } catch (error) {
      toast({
        title: 'Failed to update provider',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      toast({ title: 'Enter an API key', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings/ai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiApiKey: apiKey }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'API key saved', description: 'Your key is now active for AI features.' })
      setApiKey('')
      await loadSettings()
    } catch (error) {
      toast({
        title: 'Failed to save API key',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const removeApiKey = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/ai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiApiKey: '' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'API key removed', description: 'Falling back to free tier.' })
      await loadSettings()
    } catch (error) {
      toast({
        title: 'Failed to remove API key',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const currentProvider = settings?.availableProviders?.find(
    (p) => p.id === selectedProvider,
  )

  if (loading) {
    return (
      <Card className="border-[#D7DFEA] bg-white shadow-sm">
        <CardContent className="flex items-center justify-center py-12 text-gray-500">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
          Loading AI settings…
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <Card className="border-[#D7DFEA] bg-white shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#14B8A6]">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-black">AI Assistant Configuration</CardTitle>
              <CardDescription>
                Choose your AI provider. Free tier included — upgrade anytime with your own API key.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Provider Badge */}
          <div className="flex items-center gap-3 rounded-lg border border-[#D7DFEA] bg-[#EEF2F7] p-4">
            <Bot className="h-5 w-5 text-[#2563EB]" />
            <div className="flex-1">
              <p className="text-sm font-medium text-black">
                Current: {settings?.providerLabel}
              </p>
              <p className="text-xs text-gray-500">Model: {settings?.model}</p>
            </div>
            {settings?.hasKey ? (
              <Badge className="border-emerald-500 bg-emerald-50 text-emerald-700" variant="outline">
                <Key className="mr-1 h-3 w-3" />
                Custom key active
              </Badge>
            ) : selectedProvider === 'groq' ? (
              <Badge className="border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB]" variant="outline">
                <Zap className="mr-1 h-3 w-3" />
                Free tier
              </Badge>
            ) : (
              <Badge className="border-amber-500 bg-amber-50 text-amber-700" variant="outline">
                No key — using fallback
              </Badge>
            )}
          </div>

          <Separator />

          {/* Provider Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">AI Provider</Label>
            <Select
              value={selectedProvider}
              onValueChange={(value) => void saveProvider(value)}
              disabled={saving}
            >
              <SelectTrigger className="border-[#D7DFEA] bg-[#EEF2F7]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {settings?.availableProviders?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <span>{p.label}</span>
                      {!p.requiresKey && (
                        <Badge variant="outline" className="ml-1 text-xs border-emerald-400 text-emerald-600">
                          Free
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              {selectedProvider === 'groq'
                ? 'Groq runs Llama 3.3 70B for free. Great for lead qualification, scripts, and follow-ups. No API key required.'
                : selectedProvider === 'openai'
                  ? 'OpenAI GPT-4o delivers premium quality. Requires your own API key from platform.openai.com.'
                  : 'Anthropic Claude offers deep reasoning. Requires your own API key from console.anthropic.com.'}
            </p>
          </div>

          {/* API Key Section */}
          {currentProvider?.requiresKey && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700">
                  {selectedProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API Key
                </Label>

                {settings?.hasKey && (
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-emerald-800">Key configured</p>
                      <p className="text-xs text-emerald-600">{settings.maskedKey}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => void removeApiKey()}
                      disabled={saving}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Remove
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKey ? 'text' : 'password'}
                      placeholder={
                        selectedProvider === 'openai'
                          ? 'sk-...'
                          : 'sk-ant-...'
                      }
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="border-[#D7DFEA] bg-[#EEF2F7] pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    className="bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
                    onClick={() => void saveApiKey()}
                    disabled={saving || !apiKey.trim()}
                  >
                    {saving ? 'Saving…' : 'Save Key'}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Your key is stored securely and only used for AI features within your organization.
                  {selectedProvider === 'openai'
                    ? ' Get your key at platform.openai.com/api-keys'
                    : ' Get your key at console.anthropic.com/settings/keys'}
                </p>
              </div>
            </>
          )}

          {/* Groq free info */}
          {selectedProvider === 'groq' && (
            <>
              <Separator />
              <div className="rounded-lg border border-[#D7DFEA] bg-[#F5F7FB] p-4 space-y-2">
                <p className="text-sm font-medium text-black">Free Tier Details</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Powered by Llama 3.3 70B via Groq inference</li>
                  <li>• 30 requests per minute, 14,400 per day</li>
                  <li>• Great for lead qualification, email/SMS drafting, sales coaching</li>
                  <li>• Upgrade to OpenAI or Anthropic anytime for premium models</li>
                </ul>
                {!settings?.hasKey && (
                  <p className="text-xs text-[#2563EB] font-medium mt-2">
                    Optional: Add a Groq API key from console.groq.com for higher rate limits.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
