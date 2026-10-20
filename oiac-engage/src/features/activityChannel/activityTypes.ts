export interface ActivityAuthor { id: string | null; name: string; jobTitle: string | null }
export interface ActivityPost { id: string; content: string; author: ActivityAuthor; createdOn: string; modifiedOn: string; isPinned: boolean; pinnedOn: string | null; pinnedById: string | null; rowVersion: string; canDelete: boolean; canModerate: boolean }
export interface ActivityComment { id: string; postId: string; parentId: string | null; content: string; author: ActivityAuthor; createdOn: string }
export interface ActivityFeedPage { posts: ActivityPost[]; nextLink: string | null; totalCount: number | null; countUnavailable: boolean; currentUser: ActivityAuthor; canModerate: boolean }
export interface ActivityCommentPage { comments: ActivityComment[]; nextLink: string | null }
