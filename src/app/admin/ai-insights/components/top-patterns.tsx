/**
 * Top Patterns Component
 *
 * Displays the most successful AI-generated patterns.
 */

'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useEffect, useState, useMemo } from 'react'

interface InsightsData {
  insights?: Array<{
    topEventTypes?: string[]
  }>
}

interface EventTypeCount {
  eventType: string
  count: number
}

export function TopPatterns() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/ai/admin/insights', {
          headers: {
            'x-user-id': 'admin',
          },
        })
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (err) {
        console.error('Failed to fetch patterns:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Aggregate top event types from all user insights
  const topEventTypes = useMemo(() => {
    if (!data?.insights) return []

    const eventTypeCounts = new Map<string, number>()

    data.insights.forEach((user) => {
      user.topEventTypes?.forEach((eventType) => {
        eventTypeCounts.set(eventType, (eventTypeCounts.get(eventType) || 0) + 1)
      })
    })

    return Array.from(eventTypeCounts.entries())
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Performing Patterns</CardTitle>
        <CardDescription>Most successful event types by count</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <TopPatternsSkeleton />
        ) : topEventTypes.length > 0 ? (
          <div className="space-y-4">
            {topEventTypes.map((type, index) => (
              <div key={type.eventType} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                  <span className="font-medium">{type.eventType}</span>
                </div>
                <Badge variant="secondary">{type.count} events</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No pattern data available</p>
        )}
      </CardContent>
    </Card>
  )
}

function TopPatternsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  )
}

export { TopPatternsSkeleton as Skeleton }
