/**
 * Learning Trends Chart Component
 *
 * Displays AI learning trends over time using Recharts.
 */

'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { TrendingUp, LineChart as LineChartIcon } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'

interface TrendDataPoint {
  date: string
  interactions: number
  successRate: number
}

export function LearningTrends() {
  // Placeholder trend data - in production, fetch from API
  const trendData: TrendDataPoint[] = [
    { date: 'Week 1', interactions: 120, successRate: 65 },
    { date: 'Week 2', interactions: 145, successRate: 68 },
    { date: 'Week 3', interactions: 160, successRate: 72 },
    { date: 'Week 4', interactions: 180, successRate: 75 },
  ]

  const chartConfig = {
    interactions: {
      label: 'Interactions',
      color: 'hsl(var(--chart-1))',
    },
    successRate: {
      label: 'Success Rate (%)',
      color: 'hsl(var(--chart-2))',
    },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Learning Trends</CardTitle>
        <CardDescription>AI interaction volume and success rates over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="interactions"
              stroke="var(--color-interactions)"
              strokeWidth={2}
              name="Interactions"
            />
            <Line
              type="monotone"
              dataKey="successRate"
              stroke="var(--color-successRate)"
              strokeWidth={2}
              name="Success Rate"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function LearningTrendsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48 mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  )
}

export { LearningTrendsSkeleton as Skeleton }
