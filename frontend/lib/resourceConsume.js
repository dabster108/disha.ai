/** Shared "can the Learning panel open this in-app?" logic for resource
 * dicts from either the curriculum agent or the roadmap resource layer.
 *
 * New resources already carry `consume`/`embed_url` from the backend
 * (app/services/learning_resources.py). Older, already-persisted
 * roadmaps/curricula may only have {title, url, type, ...} — this derives
 * the same thing client-side so those still open in-app when possible
 * instead of silently breaking.
 */

const YOUTUBE_ID_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/;

export function youtubeEmbedUrl(url) {
  const match = (url || "").match(YOUTUBE_ID_RE);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

/** Returns a resource with `consume`/`embed_url` guaranteed to be set,
 * deriving them client-side for legacy resources that predate this field. */
export function resolveResourceConsume(resource) {
  if (!resource) return resource;
  if (resource.consume === "embed" || resource.consume === "markdown") return resource;

  if (resource.embed_url) return { ...resource, consume: "embed" };

  const derived = resource.type === "video" ? youtubeEmbedUrl(resource.url) : null;
  if (derived) return { ...resource, consume: "embed", embed_url: derived };

  return { ...resource, consume: null };
}

export function isInAppConsumable(resource) {
  const resolved = resolveResourceConsume(resource);
  return resolved?.consume === "embed" || resolved?.consume === "markdown";
}
