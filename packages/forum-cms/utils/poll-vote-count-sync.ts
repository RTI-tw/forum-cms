import type { KeystoneContext } from '@keystone-6/core/types'

type PrismaLike = KeystoneContext['prisma']

function parseId(v: unknown): number | null {
    if (v == null) return null
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v !== '') {
        const n = Number(v)
        return Number.isFinite(n) ? n : null
    }
    return null
}

/** 從 Keystone afterOperation 的 item／originalItem 讀取 pollId、optionId */
export function getPollVotePollAndOptionIds(
    item: Record<string, unknown> | null | undefined
): { pollId: number | null; optionId: number | null } {
    if (!item) return { pollId: null, optionId: null }
    let pollId = parseId(item.pollId)
    let optionId = parseId(item.optionId)
    if (pollId == null && item.poll && typeof item.poll === 'object') {
        pollId = parseId((item.poll as Record<string, unknown>).id)
    }
    if (optionId == null && item.option && typeof item.option === 'object') {
        optionId = parseId((item.option as Record<string, unknown>).id)
    }
    return { pollId, optionId }
}

/**
 * 依 PollVote 實際筆數重算並寫入 Poll.totalVotes、PollOption.voteCount。
 */
export async function syncPollVoteAggregates(
    prisma: PrismaLike,
    pollIds: Array<number | null | undefined>,
    optionIds: Array<number | null | undefined>
): Promise<void> {
    const pids = [
        ...new Set(
            pollIds.filter(
                (id): id is number => id != null && Number.isFinite(id)
            )
        ),
    ]
    const oids = [
        ...new Set(
            optionIds.filter(
                (id): id is number => id != null && Number.isFinite(id)
            )
        ),
    ]

    await Promise.all(
        pids.map(async (pollId) => {
            const totalVotes = await prisma.pollVote.count({ where: { pollId } })
            await prisma.poll.update({
                where: { id: pollId },
                data: { totalVotes },
            })
        })
    )

    await Promise.all(
        oids.map(async (optionId) => {
            const voteCount = await prisma.pollVote.count({
                where: { optionId },
            })
            await prisma.pollOption.update({
                where: { id: optionId },
                data: { voteCount },
            })
        })
    )
}
