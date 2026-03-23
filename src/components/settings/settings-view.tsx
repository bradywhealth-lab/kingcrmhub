'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bot,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  History,
  Key,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Shield,
  SquareKanban,
  UserPlus,
  Users,
  Webhook,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/hooks/use-toast'
import { AISettingsPanel } from '@/components/settings/ai-settings-panel'

function OrganizationSettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    logo: '',
    plan: 'pro',
    sessionTimeoutMinutes: '60',
    twoFactorRequired: false,
    usage: {
      leadsThisMonth: 0,
      teamSeatsUsed: 0,
    },
  })

  const loadOrganization = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/organization')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const organization = data.organization
      setForm({
        name: organization?.name || '',
        slug: organization?.slug || '',
        logo: organization?.logo || '',
        plan: organization?.plan || 'pro',
        sessionTimeoutMinutes: String(organization?.sessionTimeoutMinutes || 60),
        twoFactorRequired: organization?.twoFactorRequired === true,
        usage: organization?.usage || { leadsThisMonth: 0, teamSeatsUsed: 0 },
      })
    } catch (error) {
      toast({
        title: 'Failed to load organization',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOrganization()
  }, [loadOrganization])

  const saveOrganization = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          logo: form.logo,
          plan: form.plan,
          sessionTimeoutMinutes: Number(form.sessionTimeoutMinutes),
          twoFactorRequired: form.twoFactorRequired,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Organization saved', description: 'Workspace settings updated successfully.' })
      await loadOrganization()
    } catch (error) {
      toast({
        title: 'Failed to save organization',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <Card className="bg-white border-[#D7DFEA] shadow-sm"><CardContent className="p-6 text-sm text-gray-500">Loading organization…</CardContent></Card>
  }

  return (
    <Card className="bg-white border-[#D7DFEA] shadow-sm">
      <CardHeader>
        <CardTitle className="text-black">Organization profile</CardTitle>
        <CardDescription>Your workspace identity, plan, and session policy</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="text-gray-600">Organization name</Label>
            <Input className="mt-1 bg-[#EEF2F7] border-[#D7DFEA]" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <div>
            <Label className="text-gray-600">URL slug</Label>
            <Input className="mt-1 bg-[#EEF2F7] border-[#D7DFEA]" value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} />
          </div>
        </div>
        <div>
          <Label className="text-gray-600">Logo URL</Label>
          <Input className="mt-1 bg-[#EEF2F7] border-[#D7DFEA]" value={form.logo} onChange={(e) => setForm((prev) => ({ ...prev, logo: e.target.value }))} placeholder="https://..." />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="text-gray-600">Plan</Label>
            <Select value={form.plan} onValueChange={(value) => setForm((prev) => ({ ...prev, plan: value }))}>
              <SelectTrigger className="mt-1 bg-[#EEF2F7] border-[#D7DFEA]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-600">Session timeout (minutes)</Label>
            <Input type="number" className="mt-1 bg-[#EEF2F7] border-[#D7DFEA]" value={form.sessionTimeoutMinutes} onChange={(e) => setForm((prev) => ({ ...prev, sessionTimeoutMinutes: e.target.value }))} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-[#EEF2F7] p-3">
          <div>
            <p className="font-medium text-black">Require two-factor authentication</p>
            <p className="text-sm text-gray-500">Applies to all workspace admins and owners</p>
          </div>
          <Switch checked={form.twoFactorRequired} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, twoFactorRequired: checked }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-[#EEF2F7] p-4">
            <p className="text-sm text-gray-500">Leads in workspace</p>
            <p className="text-2xl font-bold text-black">{form.usage.leadsThisMonth}</p>
          </div>
          <div className="rounded-lg bg-[#EEF2F7] p-4">
            <p className="text-sm text-gray-500">Team seats used</p>
            <p className="text-2xl font-bold text-black">{form.usage.teamSeatsUsed}</p>
          </div>
        </div>
        <Button className="btn-gold" onClick={() => void saveOrganization()} disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </CardContent>
    </Card>
  )
}

function TeamSettingsPanel() {
  const [members, setMembers] = useState<Array<{ id: string; name: string | null; email: string; role: string; isActive: boolean }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'agent' })

  const loadMembers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/team-members')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMembers(Array.isArray(data.members) ? data.members : [])
    } catch (error) {
      toast({
        title: 'Failed to load team',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  const inviteMember = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setInviteLink(data.inviteLink || null)
      setInviteExpiresAt(data.inviteExpiresAt || null)
      toast({ title: 'Team member invited', description: 'Share the invite link with the new member to activate their account.' })
      setShowInvite(false)
      setInviteForm({ name: '', email: '', role: 'agent' })
      await loadMembers()
    } catch (error) {
      toast({
        title: 'Failed to invite member',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const updateMember = async (id: string, payload: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/team-members?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      await loadMembers()
    } catch (error) {
      toast({
        title: 'Failed to update member',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <Card className="bg-white border-[#D7DFEA] shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-black">Team members</CardTitle>
              <CardDescription>Invite users into this workspace and manage their role</CardDescription>
            </div>
            <Button className="btn-gold gap-2" size="sm" onClick={() => setShowInvite(true)}>
              <UserPlus className="w-4 h-4" />
              Invite member
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {inviteLink ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Invite link: <span className="font-mono break-all">{inviteLink}</span>
              {inviteExpiresAt ? <div className="mt-1 text-xs">Expires {new Date(inviteExpiresAt).toLocaleString()}</div> : null}
            </div>
          ) : null}
          {loading ? (
            <div className="text-sm text-gray-500">Loading team…</div>
          ) : (
            <div className="space-y-3">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg bg-[#EEF2F7] p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-[#2563EB] text-sm text-black">{(m.name || m.email).split(' ').map((n) => n[0]).join('').slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-black">{m.name || 'Unnamed user'}</p>
                      <p className="text-xs text-gray-500">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={m.role} onValueChange={(value) => void updateMember(m.id, { role: value })}>
                      <SelectTrigger className="h-8 w-[130px] border-[#D7DFEA] bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Switch checked={m.isActive} onCheckedChange={(checked) => void updateMember(m.id, { isActive: checked })} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="border-[#D7DFEA] bg-white">
          <DialogHeader>
            <DialogTitle className="text-black">Invite team member</DialogTitle>
            <DialogDescription>Create a team account inside this organization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-gray-600">Name</Label>
              <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={inviteForm.name} onChange={(e) => setInviteForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-gray-600">Email</Label>
              <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" type="email" value={inviteForm.email} onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))} />
            </div>
            <div>
              <Label className="text-gray-600">Role</Label>
              <Select value={inviteForm.role} onValueChange={(value) => setInviteForm((prev) => ({ ...prev, role: value }))}>
                <SelectTrigger className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[#D7DFEA]" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button className="btn-gold" onClick={() => void inviteMember()} disabled={saving}>
              {saving ? 'Creating...' : 'Create member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SecuritySettingsPanel() {
  const [keys, setKeys] = useState<Array<{ id: string; name: string; preview: string; createdAt: string; revokedAt?: string | null }>>([])
  const [sessions, setSessions] = useState<Array<{ id: string; createdAt: string; expiresAt: string; lastActiveAt: string; device?: string | null; browser?: string | null; os?: string | null; city?: string | null; country?: string | null; isCurrent: boolean }>>([])
  const [showKeys, setShowKeys] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [rawKey, setRawKey] = useState<string | null>(null)

  const loadKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/security/api-keys')
      const data = await res.json()
      if (!data.error) setKeys(Array.isArray(data.apiKeys) ? data.apiKeys : [])
    } catch {
      setKeys([])
    }
  }, [])

  useEffect(() => {
    void loadKeys()
  }, [loadKeys])

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/security/sessions')
      const data = await res.json()
      if (!data.error) setSessions(Array.isArray(data.sessions) ? data.sessions : [])
    } catch {
      setSessions([])
    }
  }, [])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  const createKey = async () => {
    try {
      const res = await fetch('/api/security/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setRawKey(data.rawKey || null)
      setNewKeyName('')
      await loadKeys()
    } catch (error) {
      toast({
        title: 'Failed to create API key',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const deleteKey = async (id: string) => {
    try {
      const res = await fetch(`/api/security/api-keys?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      await loadKeys()
    } catch (error) {
      toast({
        title: 'Failed to revoke API key',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const revokeSession = async (id: string) => {
    try {
      const res = await fetch(`/api/security/sessions?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      await loadSessions()
      toast({ title: 'Session revoked', description: 'The selected session has been signed out.' })
    } catch (error) {
      toast({
        title: 'Failed to revoke session',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <Card className="bg-white border-[#D7DFEA] shadow-sm">
        <CardHeader>
          <CardTitle className="text-black">Security</CardTitle>
          <CardDescription>2FA policy, API keys, and session governance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg bg-[#EEF2F7] p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-[#2563EB]" />
              <div>
                <p className="font-medium text-black">Two-factor enforcement</p>
                <p className="text-xs text-gray-500">Managed from Organization settings</p>
              </div>
            </div>
            <Badge variant="outline" className="border-[#D7DFEA]">Org policy</Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[#EEF2F7] p-4">
            <div className="flex items-center gap-3">
              <Key className="h-5 w-5 text-[#2563EB]" />
              <div>
                <p className="font-medium text-black">API keys</p>
                <p className="text-xs text-gray-500">Generate and revoke workspace keys</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="border-[#2563EB] text-[#2563EB]" onClick={() => setShowKeys(true)}>Manage</Button>
          </div>
          <div className="rounded-lg border border-[#D7DFEA] bg-[#EEF2F7] p-4">
            <div className="mb-3 flex items-center gap-3">
              <Shield className="h-5 w-5 text-[#2563EB]" />
              <div>
                <p className="font-medium text-black">Active sessions</p>
                <p className="text-xs text-gray-500">Review devices signed into this account and revoke old sessions.</p>
              </div>
            </div>
            <div className="space-y-2">
              {sessions.length === 0 ? (
                <p className="text-sm text-gray-500">No active sessions found.</p>
              ) : sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#D7DFEA] bg-white p-3">
                  <div>
                    <p className="text-sm font-medium text-black">
                      {[session.device, session.browser, session.os].filter(Boolean).join(' • ') || 'Current device'}
                      {session.isCurrent ? ' • Current session' : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      Last active {new Date(session.lastActiveAt).toLocaleString()}
                      {session.city || session.country ? ` • ${[session.city, session.country].filter(Boolean).join(', ')}` : ''}
                    </p>
                  </div>
                  <Button variant="outline" className="border-[#D7DFEA]" onClick={() => void revokeSession(session.id)} disabled={session.isCurrent}>
                    {session.isCurrent ? 'Current' : 'Revoke'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showKeys} onOpenChange={setShowKeys}>
        <DialogContent className="border-[#D7DFEA] bg-white">
          <DialogHeader>
            <DialogTitle className="text-black">Workspace API keys</DialogTitle>
            <DialogDescription>Create a key once, then store the raw value securely.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {rawKey ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                New key: <span className="font-mono break-all">{rawKey}</span>
              </div>
            ) : null}
            <div className="flex gap-2">
              <Input className="border-[#D7DFEA] bg-[#EEF2F7]" placeholder="Key name" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
              <Button className="btn-gold" onClick={() => void createKey()}>Create key</Button>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {keys.map((key) => (
                <div key={key.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#D7DFEA] bg-[#EEF2F7] p-3">
                  <div>
                    <p className="text-sm font-medium text-black">{key.name}</p>
                    <p className="text-xs text-gray-500">
                      {key.preview} • {new Date(key.createdAt).toLocaleString()}
                      {key.revokedAt ? ` • revoked ${new Date(key.revokedAt).toLocaleString()}` : ''}
                    </p>
                  </div>
                  <Button variant="outline" className="border-[#D7DFEA]" onClick={() => void deleteKey(key.id)} disabled={Boolean(key.revokedAt)}>
                    {key.revokedAt ? 'Revoked' : 'Revoke'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function BillingSettingsPanel() {
  const [plan, setPlan] = useState('pro')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void fetch('/api/settings/organization')
      .then((res) => res.json())
      .then((data) => {
        if (!data.error && data.organization?.plan) setPlan(data.organization.plan)
      })
      .catch(() => null)
  }, [])

  const savePlan = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Plan updated', description: `Workspace plan set to ${plan}.` })
    } catch (error) {
      toast({
        title: 'Failed to update plan',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-white border-[#D7DFEA] shadow-sm">
      <CardHeader>
        <CardTitle className="text-black">Billing & plan</CardTitle>
        <CardDescription>Persist the active workspace plan inside the CRM</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-gray-600">Current plan</Label>
          <Select value={plan} onValueChange={setPlan}>
            <SelectTrigger className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="btn-gold" onClick={() => void savePlan()} disabled={saving}>{saving ? 'Saving...' : 'Upgrade or change plan'}</Button>
      </CardContent>
    </Card>
  )
}

function AuditLogPanel() {
  const [logs, setLogs] = useState<Array<{ id: string; action: string; entityType: string; description: string; createdAt: string }>>([])
  const [loading, setLoading] = useState(true)

  const loadLogs = useCallback(async (limit = 50) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/audit-logs?limit=${limit}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setLogs(Array.isArray(data.logs) ? data.logs : [])
    } catch (error) {
      toast({
        title: 'Failed to load audit log',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLogs(25)
  }, [loadLogs])

  return (
    <Card className="bg-white border-[#D7DFEA] shadow-sm">
      <CardHeader>
        <CardTitle className="text-black">Audit log</CardTitle>
        <CardDescription>Recent actions across the organization</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-gray-500">Loading audit log…</div>
        ) : (
          <div className="space-y-2">
            {logs.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 border-b border-[#D7DFEA] py-2 last:border-0">
                <span className="text-sm text-black">{e.description}</span>
                <span className="text-right text-xs text-gray-500">{e.action} • {e.entityType} • {new Date(e.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" className="mt-4 w-full border-[#D7DFEA]" onClick={() => void loadLogs(100)}>View full audit log</Button>
      </CardContent>
    </Card>
  )
}

function CarrierLibrarySettings() {
  type Carrier = { id: string; name: string; slug: string; website?: string | null; _count?: { documents: number } }
  type CarrierDoc = { id: string; type: string; name: string; fileUrl: string; createdAt: string; version?: string | null }

  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>('')
  const [documents, setDocuments] = useState<CarrierDoc[]>([])
  const [newCarrierName, setNewCarrierName] = useState('')
  const [newCarrierWebsite, setNewCarrierWebsite] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadType, setUploadType] = useState('brochure')
  const [uploadName, setUploadName] = useState('')
  const [uploadVersion, setUploadVersion] = useState('')
  const [docFilter, setDocFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const underwritingChecklist = [
    'Medical history questionnaire',
    'Prescription history check',
    'Build/height-weight review',
    'Lifestyle risk notes (smoker, aviation, diving)',
    'Financial suitability notes',
  ]

  const loadCarriers = useCallback(async () => {
    const res = await fetch('/api/carriers')
    const data = await res.json()
    if (!data.error) {
      setCarriers(data.carriers || [])
      if (!selectedCarrierId && data.carriers?.[0]?.id) setSelectedCarrierId(data.carriers[0].id)
    }
  }, [selectedCarrierId])

  const loadDocuments = useCallback(async () => {
    if (!selectedCarrierId) {
      setDocuments([])
      return
    }
    const res = await fetch(`/api/carriers/${selectedCarrierId}/documents`)
    const data = await res.json()
    if (!data.error) setDocuments(data.documents || [])
  }, [selectedCarrierId])

  useEffect(() => {
    void loadCarriers()
  }, [loadCarriers])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  const createCarrier = async () => {
    if (!newCarrierName.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/carriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCarrierName, website: newCarrierWebsite }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Carrier added', description: `${newCarrierName} created successfully.` })
      setNewCarrierName('')
      setNewCarrierWebsite('')
      await loadCarriers()
    } catch (error) {
      toast({ title: 'Failed to add carrier', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const uploadDocument = async () => {
    if (!selectedCarrierId || !uploadFile) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('type', uploadType)
      formData.append('name', uploadName || uploadFile.name)
      formData.append('version', uploadVersion)
      const res = await fetch(`/api/carriers/${selectedCarrierId}/documents`, { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Document uploaded', description: 'Carrier document saved.' })
      setUploadFile(null)
      setUploadName('')
      setUploadVersion('')
      await loadDocuments()
      await loadCarriers()
    } catch (error) {
      toast({ title: 'Upload failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const selectedCarrier = carriers.find((c) => c.id === selectedCarrierId)
  const filteredDocuments = documents.filter((doc) => docFilter === 'all' || doc.type === docFilter)

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card className="bg-white border-[#D7DFEA] shadow-sm">
        <CardHeader>
          <CardTitle className="text-black">Insurance Carriers</CardTitle>
          <CardDescription>Store life/health carriers and underwriting libraries.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input className="border-[#D7DFEA] bg-[#EEF2F7]" placeholder="Carrier name" value={newCarrierName} onChange={(e) => setNewCarrierName(e.target.value)} />
          <Input className="border-[#D7DFEA] bg-[#EEF2F7]" placeholder="Website (optional)" value={newCarrierWebsite} onChange={(e) => setNewCarrierWebsite(e.target.value)} />
          <Button className="btn-gold w-full" onClick={() => void createCarrier()} disabled={loading}>Add Carrier</Button>
          <Separator />
          <div className="rounded-lg border border-[#D7DFEA] bg-[#EEF2F7] p-3">
            <p className="text-xs font-medium text-black">Broker workflow shortcuts</p>
            <p className="mt-1 text-xs text-gray-500">Store each carrier’s brochure, underwriting guide, and app form with version tracking.</p>
          </div>
          <div className="max-h-[320px] space-y-2 overflow-auto">
            {carriers.map((carrier) => (
              <button
                type="button"
                key={carrier.id}
                onClick={() => setSelectedCarrierId(carrier.id)}
                className={cn(
                  'w-full rounded-lg border p-3 text-left',
                  selectedCarrierId === carrier.id ? 'border-[#2563EB] bg-[#2563EB]/10' : 'border-[#D7DFEA] bg-[#EEF2F7]',
                )}
              >
                <p className="text-sm font-medium text-black">{carrier.name}</p>
                <p className="text-xs text-gray-500">{carrier.website || 'No website'} • {carrier._count?.documents || 0} docs</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-[#D7DFEA] shadow-sm xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-black">Carrier Document Library</CardTitle>
          <CardDescription>
            {selectedCarrier ? `Upload brochures and underwriting guidelines for ${selectedCarrier.name}.` : 'Select a carrier to manage files.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedCarrier && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <Label className="text-gray-600">Document name</Label>
                <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="2026 Term Life Brochure" />
              </div>
              <div>
                <Label className="text-gray-600">Type</Label>
                <Select value={uploadType} onValueChange={setUploadType}>
                  <SelectTrigger className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brochure">Brochure</SelectItem>
                    <SelectItem value="underwriting_guidelines">Underwriting Guidelines</SelectItem>
                    <SelectItem value="application">Application</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-600">Version</Label>
                <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={uploadVersion} onChange={(e) => setUploadVersion(e.target.value)} placeholder="v1.0" />
              </div>
              <div className="md:col-span-3">
                <Label className="text-gray-600">File</Label>
                <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              </div>
              <div className="flex items-end">
                <Button className="btn-gold w-full" onClick={() => void uploadDocument()} disabled={loading || !uploadFile}>
                  Upload
                </Button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label className="text-gray-600">Document filter</Label>
              <Select value={docFilter} onValueChange={setDocFilter}>
                <SelectTrigger className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="brochure">Brochure</SelectItem>
                  <SelectItem value="underwriting_guidelines">Underwriting Guidelines</SelectItem>
                  <SelectItem value="application">Application</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-[#D7DFEA] bg-[#EEF2F7] p-3">
              <p className="text-xs font-medium text-black">Underwriting Prep Checklist</p>
              <div className="mt-1 space-y-1">
                {underwritingChecklist.slice(0, 3).map((item) => (
                  <p key={item} className="text-[11px] text-gray-500">- {item}</p>
                ))}
              </div>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            {filteredDocuments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#D7DFEA] p-5 text-sm text-gray-500">
                No documents yet. Upload brochures and underwriting guidelines here.
              </div>
            ) : filteredDocuments.map((doc) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#D7DFEA] bg-[#EEF2F7] p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-black">{doc.name}</p>
                  <p className="text-xs capitalize text-gray-500">{doc.type.replaceAll('_', ' ')} {doc.version ? `• ${doc.version}` : ''}</p>
                </div>
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-[#2563EB] hover:underline">Open</a>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function TwilioIntegrationCard() {
  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [fromPhone, setFromPhone] = useState('')
  const [hasAuthToken, setHasAuthToken] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadTwilio = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/integrations?type=twilio')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const integration = data.integration
      if (integration?.config) {
        setAccountSid(integration.config.accountSid || '')
        setFromPhone(integration.config.fromPhone || '')
        setHasAuthToken(!!integration.config.hasAuthToken)
        setIsActive(integration.isActive !== false)
        setSyncStatus(integration.syncStatus || null)
      }
    } catch (error) {
      toast({
        title: 'Failed to load Twilio settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTwilio()
  }, [loadTwilio])

  const saveTwilio = async () => {
    if (!accountSid.trim() || !fromPhone.trim()) {
      toast({
        title: 'Twilio config incomplete',
        description: 'Account SID and from phone are required.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'twilio',
          name: 'Twilio SMS',
          isActive,
          config: {
            accountSid,
            authToken: authToken.trim() || undefined,
            fromPhone,
          },
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setHasAuthToken(Boolean(data.integration?.config?.hasAuthToken))
      setAuthToken('')
      setSyncStatus(data.integration?.syncStatus || 'configured')
      toast({ title: 'Twilio saved', description: 'SMS sending is now configured for this workspace.' })
    } catch (error) {
      toast({
        title: 'Failed to save Twilio',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-white border-[#D7DFEA] shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-black">
              <Phone className="h-5 w-5 text-[#2563EB]" />
              Twilio SMS
            </CardTitle>
            <CardDescription>Send live SMS and receive delivery/inbound updates.</CardDescription>
          </div>
          <Badge variant="outline" className={cn(
            isActive ? 'border-emerald-500 text-emerald-600' : 'border-gray-400 text-gray-500',
          )}>
            {isActive ? (syncStatus || 'active') : 'inactive'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-sm text-gray-500">Loading Twilio settings…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label className="text-gray-600">Account SID</Label>
                <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={accountSid} onChange={(e) => setAccountSid(e.target.value)} placeholder="AC..." />
              </div>
              <div>
                <Label className="text-gray-600">From phone</Label>
                <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={fromPhone} onChange={(e) => setFromPhone(e.target.value)} placeholder="+15551234567" />
              </div>
            </div>
            <div>
              <Label className="text-gray-600">Auth token</Label>
              <Input
                type="password"
                className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder={hasAuthToken ? 'Stored. Enter a new token only to rotate it.' : 'Twilio auth token'}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#EEF2F7] p-3">
              <div>
                <p className="text-sm font-medium text-black">Webhook target</p>
                <p className="break-all text-xs text-gray-500">
                  {`${typeof window !== 'undefined' ? window.location.origin : process.env.APP_BASE_URL || 'https://your-app.example.com'}/api/webhooks/twilio/<organizationId>`}
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <Button className="btn-gold" onClick={() => void saveTwilio()} disabled={saving}>
              {saving ? 'Saving...' : 'Save Twilio'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function SettingsIntegrationsPanel() {
  const integrationDefinitions = [
    { type: 'google_calendar', name: 'Google Calendar', icon: Calendar, description: 'Sync meetings and events' },
    { type: 'linear', name: 'Linear', icon: SquareKanban, description: 'Issue tracking & project management' },
    { type: 'smtp', name: 'Email (SMTP)', icon: Mail, description: 'Send and track emails' },
    { type: 'slack', name: 'Slack', icon: MessageSquare, description: 'Deal and lead notifications' },
    { type: 'zapier', name: 'Zapier', icon: Zap, description: 'Connect 5,000+ apps' },
  ]

  const [integrations, setIntegrations] = useState<Record<string, { isActive: boolean; syncStatus?: string | null; config?: Record<string, unknown> }>>({})
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [configName, setConfigName] = useState('')
  const [configField, setConfigField] = useState('')
  const [configValue, setConfigValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadIntegrations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/integrations')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const next: Record<string, { isActive: boolean; syncStatus?: string | null; config?: Record<string, unknown> }> = {}
      for (const item of data.integrations || []) {
        next[item.type] = {
          isActive: item.isActive !== false,
          syncStatus: item.syncStatus || null,
          config: item.config || {},
        }
      }
      setIntegrations(next)
    } catch (error) {
      toast({
        title: 'Failed to load integrations',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadIntegrations()
  }, [loadIntegrations])

  const openConfig = (type: string, defaultName: string) => {
    const existing = integrations[type]
    const existingConfig = existing?.config || {}
    const firstKey = Object.keys(existingConfig)[0] || 'account'
    setSelectedType(type)
    setConfigName(defaultName)
    setConfigField(firstKey)
    setConfigValue(typeof existingConfig[firstKey] === 'string' ? String(existingConfig[firstKey]) : '')
  }

  const saveIntegration = async () => {
    if (!selectedType || !configName.trim() || !configField.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          name: configName,
          isActive: true,
          config: { [configField]: configValue },
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Integration saved', description: `${configName} is now configured.` })
      setSelectedType(null)
      await loadIntegrations()
    } catch (error) {
      toast({
        title: 'Failed to save integration',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card className="bg-white border-[#D7DFEA] shadow-sm">
        <CardHeader>
          <CardTitle className="text-black">Integrations</CardTitle>
          <CardDescription>Connect email, calendar, SMS, and more</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-sm text-gray-500">Loading integrations…</div>
          ) : integrationDefinitions.map((i) => {
            const item = integrations[i.type]
            const connected = item?.isActive
            return (
              <div key={i.type} className="flex items-center justify-between rounded-lg bg-[#EEF2F7] p-4">
                <div className="flex items-center gap-3">
                  <i.icon className="h-5 w-5 text-[#2563EB]" />
                  <div>
                    <p className="text-sm font-medium text-black">{i.name}</p>
                    <p className="text-xs text-gray-500">{i.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn(
                    connected ? 'border-emerald-500 text-emerald-600' : 'border-gray-400 text-gray-500',
                  )}>
                    {connected ? (item?.syncStatus || 'connected') : 'disconnected'}
                  </Badge>
                  <Button variant="outline" size="sm" className="border-[#D7DFEA]" onClick={() => openConfig(i.type, i.name)}>
                    {connected ? 'Configure' : 'Connect'}
                  </Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Dialog open={!!selectedType} onOpenChange={(open) => !open && setSelectedType(null)}>
        <DialogContent className="border-[#D7DFEA] bg-white">
          <DialogHeader>
            <DialogTitle className="text-black">{configName || 'Configure Integration'}</DialogTitle>
            <DialogDescription>Save a basic integration record so the app can use and display it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-gray-600">Display name</Label>
              <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={configName} onChange={(e) => setConfigName(e.target.value)} />
            </div>
            <div>
              <Label className="text-gray-600">Config field</Label>
              <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={configField} onChange={(e) => setConfigField(e.target.value)} placeholder="calendarId, workspaceId, smtpHost..." />
            </div>
            <div>
              <Label className="text-gray-600">Config value</Label>
              <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={configValue} onChange={(e) => setConfigValue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[#D7DFEA]" onClick={() => setSelectedType(null)}>Cancel</Button>
            <Button className="btn-gold" onClick={() => void saveIntegration()} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function WebhooksSettingsPanel() {
  const [hooks, setHooks] = useState<Array<{ id: string; name: string; url: string; events: string[]; isActive: boolean }>>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    url: '',
    events: 'lead.created,lead.updated,deal.won',
    secret: '',
  })

  const loadHooks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/webhooks')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setHooks((data.webhooks || []).map((hook: Record<string, unknown>) => ({
        id: String(hook.id),
        name: String(hook.name),
        url: String(hook.url),
        events: Array.isArray(hook.events) ? hook.events as string[] : [],
        isActive: hook.isActive !== false,
      })))
    } catch (error) {
      toast({
        title: 'Failed to load webhooks',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHooks()
  }, [loadHooks])

  const createHook = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          url: form.url,
          secret: form.secret || undefined,
          events: form.events.split(',').map((v) => v.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Webhook added', description: `${form.name} created successfully.` })
      setOpen(false)
      setForm({ name: '', url: '', events: 'lead.created,lead.updated,deal.won', secret: '' })
      await loadHooks()
    } catch (error) {
      toast({
        title: 'Failed to create webhook',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const deleteHook = async (id: string) => {
    try {
      const res = await fetch(`/api/webhooks?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      await loadHooks()
    } catch (error) {
      toast({
        title: 'Failed to delete webhook',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <Card className="bg-white border-[#D7DFEA] shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-black">Webhooks</CardTitle>
              <CardDescription>Send events to your endpoints</CardDescription>
            </div>
            <Button className="btn-gold gap-2" size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Add webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-gray-500">Loading webhooks…</div>
          ) : hooks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#D7DFEA] p-6 text-center text-sm text-gray-500">
              No webhooks yet. Add one to receive lead.created, deal.won, etc.
            </div>
          ) : (
            <div className="space-y-3">
              {hooks.map((hook) => (
                <div key={hook.id} className="flex items-start justify-between gap-3 rounded-lg border border-[#D7DFEA] bg-[#EEF2F7] p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-black">{hook.name}</p>
                    <p className="break-all text-xs text-gray-500">{hook.url}</p>
                    <p className="mt-1 text-xs text-gray-500">{hook.events.join(', ')}</p>
                  </div>
                  <Button variant="outline" size="sm" className="border-[#D7DFEA]" onClick={() => void deleteHook(hook.id)}>
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-[#D7DFEA] bg-white">
          <DialogHeader>
            <DialogTitle className="text-black">Add Webhook</DialogTitle>
            <DialogDescription>Create a webhook endpoint for CRM events.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-gray-600">Name</Label>
              <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-gray-600">URL</Label>
              <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={form.url} onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))} />
            </div>
            <div>
              <Label className="text-gray-600">Events</Label>
              <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={form.events} onChange={(e) => setForm((prev) => ({ ...prev, events: e.target.value }))} />
            </div>
            <div>
              <Label className="text-gray-600">Secret</Label>
              <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={form.secret} onChange={(e) => setForm((prev) => ({ ...prev, secret: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[#D7DFEA]" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="btn-gold" onClick={() => void createHook()} disabled={saving}>
              {saving ? 'Saving...' : 'Create Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function SettingsView() {
  const [activeSettingsTab, setActiveSettingsTab] = useState('organization')

  return (
    <div className="min-h-screen space-y-6 bg-[#F5F7FB] p-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Settings</h1>
        <p className="text-gray-500">Multi-tenant organization, team, security, and integrations</p>
      </div>

      <Tabs value={activeSettingsTab} onValueChange={setActiveSettingsTab} className="w-full">
        <TabsList className="flex h-auto flex-wrap gap-1 border border-[#D7DFEA] bg-[#EEF2F7] p-1">
          <TabsTrigger value="organization" className="gap-2 data-[state=active]:bg-[#2563EB] data-[state=active]:text-black">
            <Building2 className="h-4 w-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2 data-[state=active]:bg-[#2563EB] data-[state=active]:text-black">
            <Users className="h-4 w-4" />
            Team & roles
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-[#2563EB] data-[state=active]:text-black">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2 data-[state=active]:bg-[#2563EB] data-[state=active]:text-black">
            <Zap className="h-4 w-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="carriers" className="gap-2 data-[state=active]:bg-[#2563EB] data-[state=active]:text-black">
            <FileText className="h-4 w-4" />
            Carriers & Docs
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2 data-[state=active]:bg-[#2563EB] data-[state=active]:text-black">
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2 data-[state=active]:bg-[#2563EB] data-[state=active]:text-black">
            <Bot className="h-4 w-4" />
            AI
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2 data-[state=active]:bg-[#2563EB] data-[state=active]:text-black">
            <DollarSign className="h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2 data-[state=active]:bg-[#2563EB] data-[state=active]:text-black">
            <History className="h-4 w-4" />
            Audit log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="mt-6 space-y-6">
          <OrganizationSettingsPanel />
        </TabsContent>

        <TabsContent value="team" className="mt-6 space-y-6">
          <TeamSettingsPanel />
        </TabsContent>

        <TabsContent value="security" className="mt-6 space-y-6">
          <SecuritySettingsPanel />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6 space-y-6">
          <TwilioIntegrationCard />
          <SettingsIntegrationsPanel />
        </TabsContent>

        <TabsContent value="carriers" className="mt-6 space-y-6">
          <CarrierLibrarySettings />
        </TabsContent>

        <TabsContent value="webhooks" className="mt-6 space-y-6">
          <WebhooksSettingsPanel />
        </TabsContent>

        <TabsContent value="ai" className="mt-6 space-y-6">
          <AISettingsPanel />
        </TabsContent>

        <TabsContent value="billing" className="mt-6 space-y-6">
          <BillingSettingsPanel />
        </TabsContent>

        <TabsContent value="audit" className="mt-6 space-y-6">
          <AuditLogPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
