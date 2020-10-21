import gql from 'tagged-template-noop'
import sourcegraph from 'sourcegraph'

/**
 * Resolve a URI of the forms git://github.com/owner/repo?rev#path and file:///path to an absolute reference, using
 * the given base (root) URI.
 */
export function resolveURI(uri: string): { repo: string; rev: string; path: string } {
    const url = new URL(uri)
    if (url.protocol === 'git:') {
        return {
            repo: (url.host + url.pathname).replace(/^\/*/, '').toLowerCase(),
            rev: url.search.slice(1).toLowerCase(),
            path: url.hash.slice(1),
        }
    }
    throw new Error(`unrecognized URI: ${JSON.stringify(uri)} (supported URI schemes: git)`)
}

export interface Hunk {
    startLine: number
    endLine: number
    author: {
        person: {
            email: string
            displayName: string
            user: {
                username: string
            } | null
        }
        date: string
    }
    rev: string
    message: string
    commit: {
        url: string
    }
}

export const queryBlameHunks = async (uri: string): Promise<Hunk[]> => {
    const { repo, rev, path } = resolveURI(uri)
    const { data, errors } = await sourcegraph.commands.executeCommand(
        'queryGraphQL',
        gql`
            query GitBlame($repo: String!, $rev: String!, $path: String!) {
                repository(name: $repo) {
                    commit(rev: $rev) {
                        blob(path: $path) {
                            blame(startLine: 0, endLine: 0) {
                                startLine
                                endLine
                                author {
                                    person {
                                        email
                                        displayName
                                        user {
                                            username
                                        }
                                    }
                                    date
                                }
                                message
                                rev
                                commit {
                                    url
                                }
                            }
                        }
                    }
                }
            }
        `,
        { repo, rev, path }
    )
    if (errors && errors.length > 0) {
        throw new Error(errors.join('\n'))
    }
    if (!data || !data.repository || !data.repository.commit || !data.repository.commit.blob) {
        throw new Error('no blame data is available (repository, commit, or path not found)')
    }
    return data.repository.commit.blob.blame
}
