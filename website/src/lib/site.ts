/** Where DevStack lives, for links across the site. */
export const REPOSITORY = 'https://github.com/3ncryptor/DevStack'
export const NPM_PACKAGE = 'https://www.npmjs.com/package/create-devstack-app'

const STARS_REVALIDATE_S = 3600

/** The repository's star count, refreshed hourly; undefined when GitHub does not answer. */
export async function githubStars(): Promise<number | undefined> {
  try {
    const response = await fetch('https://api.github.com/repos/3ncryptor/DevStack', {
      next: { revalidate: STARS_REVALIDATE_S }
    })
    if (!response.ok) return undefined
    const { stargazers_count: stars } = (await response.json()) as { stargazers_count?: number }
    return stars
  } catch {
    return undefined
  }
}
