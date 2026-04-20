import { useEffect, useMemo, useState } from 'react'
import {
  ListNavItems,
  NavItem,
  NavigationContainer,
  type NavigationProps,
} from '@keystone-6/core/admin-ui/components'

type PendingCounts = {
  pendingReports: number
  pendingPosts: number
}

const EMPTY_COUNTS: PendingCounts = {
  pendingReports: 0,
  pendingPosts: 0,
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: '12px',
        fontWeight: 700,
        color: '#64748b',
        letterSpacing: '0.04em',
        marginTop: '16px',
        marginBottom: '6px',
      }}
    >
      {title}
    </div>
  )
}

export function CustomNavigation({ lists }: NavigationProps) {
  const [counts, setCounts] = useState<PendingCounts>(EMPTY_COUNTS)

  useEffect(() => {
    let isActive = true

    async function loadCounts() {
      try {
        const response = await fetch('/api/admin-navigation-counts', {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        })

        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as Partial<PendingCounts>

        if (!isActive) {
          return
        }

        setCounts({
          pendingReports:
            typeof payload.pendingReports === 'number'
              ? payload.pendingReports
              : 0,
          pendingPosts:
            typeof payload.pendingPosts === 'number' ? payload.pendingPosts : 0,
        })
      } catch (_error) {
        // Keep sidebar usable even if count API fails.
      }
    }

    loadCounts()
    const timer = window.setInterval(loadCounts, 30_000)

    return () => {
      isActive = false
      window.clearInterval(timer)
    }
  }, [])

  const hasReportList = lists.some((list) => list.key === 'Report')
  const hasPostList = lists.some((list) => list.key === 'Post')
  const otherListKeys = useMemo(
    () => lists.map((list) => list.key).filter((key) => key !== 'Report' && key !== 'Post'),
    [lists]
  )

  return (
    <NavigationContainer>
      <NavItem href="/">Dashboard</NavItem>

      {hasReportList ? (
        <>
          <SectionTitle title={`檢舉管理 🔴 ${counts.pendingReports}`} />
          <ListNavItems lists={lists} include={['Report']} />
        </>
      ) : null}

      {hasPostList ? (
        <>
          <SectionTitle title={`貼文待審 🔵 ${counts.pendingPosts}`} />
          <ListNavItems lists={lists} include={['Post']} />
        </>
      ) : null}

      {otherListKeys.length > 0 ? (
        <>
          <SectionTitle title="其他功能" />
          <ListNavItems lists={lists} include={otherListKeys} />
        </>
      ) : null}
    </NavigationContainer>
  )
}
