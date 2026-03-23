/**
 * Admin AI Insights Dashboard
 *
 * Displays system-wide AI learning metrics and insights.
 * Requires admin or owner role to access.
 */

import { Suspense } from 'react'
import { OverviewCards, Skeleton as OverviewCardsSkeleton } from './components/overview-cards'
import { LearningTrends, Skeleton as LearningTrendsSkeleton } from './components/learning-trends'
import { TopPatterns, Skeleton as TopPatternsSkeleton } from './components/top-patterns'
import { ScrapingPerformance, Skeleton as ScrapingPerformanceSkeleton } from './components/scraping-performance'

export const metadata = {
  title: 'AI Insights - Admin',
  description: 'System-wide AI learning metrics and insights'
}

export default function AdminAIInsightsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Learning Insights</h1>
        <p className="text-muted-foreground mt-2">
          System-wide metrics and patterns extracted from AI interactions
        </p>
      </div>

      <Suspense fallback={<OverviewCardsSkeleton />}>
        <OverviewCards />
      </Suspense>

      <div className="grid gap-8 md:grid-cols-2">
        <Suspense fallback={<LearningTrendsSkeleton />}>
          <LearningTrends />
        </Suspense>

        <Suspense fallback={<TopPatternsSkeleton />}>
          <TopPatterns />
        </Suspense>
      </div>

      <Suspense fallback={<ScrapingPerformanceSkeleton />}>
        <ScrapingPerformance />
      </Suspense>
    </div>
  )
}
