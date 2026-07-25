export const blogPosts = [
  {
    slug: "wormkey-0-4-agent-native",
    title: "Wormkey 0.4 — built for agents, safer for everyone",
    description:
      "A security-first release with remote tunnel controls, JSON output, request inspection, replay, and an MCP server.",
    date: "July 25, 2026",
    readingTime: "6 min read",
  },
  {
    slug: "how-wormkey-works",
    title: "How Wormkey works — and why I built it",
    description:
      "A short story about building a localhost tunnel that just works. No account, no dashboard, no friction.",
    date: "March 7, 2026",
    readingTime: "5 min read",
  },
] as const;

export const latestBlogPost = blogPosts[0];
