/**
 * Overview Cards Component
 *
 * Displays high-level metrics cards for the AI learning system.
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, TrendingUp, Users, Zap, LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

interface MetricData {
  summary: {
    totalProfiles: number
    activeLearners: number
    totalInteractions: number
    totalSuccessful: number
    avgSuccessRate: number
  }
  insights: Array<{
    userId: string
    totalInteractions: number
    successfulPredictions: number
    successRate: number
    hasLearnedPatterns: boolean
  }>
}

interface MetricCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  description: string
}

function MetricCard({ title, value, icon: Icon, description }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  )
}

export function OverviewCards() {
  const [data, setData] = useState<MetricData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/ai/admin/insights', {
          headers: {
            'x-user-id': 'admin',
          },
        })
        if (!response.ok) {
          throw new Error('Failed to fetch overview data')
        }
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <OverviewCardsSkeleton />
  }

  if (error || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Error loading metrics</p>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Total Profiles"
        value={data.summary.totalProfiles}
        icon={Users}
        description="Users with learning data"
      />
      <MetricCard
        title="Total Events"
        value={data.summary.totalInteractions}
        icon={Activity}
        description="Tracked interactions"
      />
      <MetricCard
        title="Success Rate"
        value={`${(data.summary.avgSuccessRate * 100).toFixed(1)}%`}
        icon={TrendingUp}
        description="Successful outcomes"
      />
      <MetricCard
        title="Patterns Found"
        value={data.insights.filter((i) => i.hasLearnedPatterns).length}
        icon={Zap}
        description="Active insights"
      />
    </div>
  )
}

function OverviewCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export { OverviewCardsSkeleton as Skeleton }
