/**
 * Scraping Performance Component
 *
 * Displays scraping source performance metrics.
 */

'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Database } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ScrapingSource {
  id: string
  sourceDomain: string
  leadsCreated?: number
  conversionRate?: number
}

export function ScrapingPerformance() {
  const [sources, setSources] = useState<ScrapingSource[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/scraping/performance')
        if (response.ok) {
          const result = await response.json()
          setSources(result)
        }
      } catch (err) {
        console.error('Failed to fetch scraping performance:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scraping Performance</CardTitle>
        <CardDescription>Lead source performance by conversion rate</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ScrapingPerformanceSkeleton />
        ) : sources.length > 0 ? (
          <div className="space-y-4">
            {sources.slice(0, 10).map((source, index) => (
              <div key={source.id || index} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{source.sourceDomain}</p>
                  <p className="text-sm text-muted-foreground">
                    {source.leadsCreated || 0} leads created
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {source.conversionRate ? `${(source.conversionRate * 100).toFixed(1)}%` : 'N/A'}
                  </p>
                  <p className="text-sm text-muted-foreground">conversion rate</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <div className="text-center">
              <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No scraping data available</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ScrapingPerformanceSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="space-y-2 text-right">
            <Skeleton className="h-4 w-16 ml-auto" />
            <Skeleton className="h-3 w-24 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  )
}

export { ScrapingPerformanceSkeleton as Skeleton }
