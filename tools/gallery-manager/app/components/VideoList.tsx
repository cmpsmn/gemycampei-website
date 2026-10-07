/**
 * ============================================================================
 * VIDEOS  (app/components/VideoList.tsx)
 * ============================================================================
 *
 * The Vimeo videos of a gallery (used by the Super 8 gallery). Per video:
 *   Vimeo number · title (English, German when switched on) · preview image
 *
 * Preview images are uploaded right away into the gallery's posters/ folder.
 * The list itself is part of the gallery form and saved with "Save changes".
 * ============================================================================
 */
import { useRef } from 'react';
import { api, photoUrl } from '../api';
import type { Video } from '../types';
import type { Notify } from '../App';

interface Props {
  galleryId: string;
  videos: Video[];
  germanTitles: string[];
  /** File names in posters/ */
  posters: string[];
  german: boolean;
  notify: Notify;
  onChange: (videos: Video[], germanTitles: string[]) => void;
  onPosterUploaded: () => Promise<void>;
}

/** "https://vimeo.com/1226323019" or "1226323019" → "1226323019" */
const vimeoNumber = (text: string) => text.match(/(\d{6,})/)?.[1] ?? text.replace(/\D/g, '');

export default function VideoList({ galleryId, videos, germanTitles, posters, german, notify, onChange, onPosterUploaded }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  /** Which video the next uploaded preview image belongs to */
  const uploadFor = useRef(0);

  const titles = videos.map((_, i) => germanTitles[i] ?? '');

  function update(index: number, patch: Partial<Video>) {
    onChange(videos.map((v, i) => (i === index ? { ...v, ...patch } : v)), titles);
  }

  function move(index: number, by: number) {
    const target = index + by;
    if (target < 0 || target >= videos.length) return;
    const nextVideos = [...videos];
    const nextTitles = [...titles];
    [nextVideos[index], nextVideos[target]] = [nextVideos[target], nextVideos[index]];
    [nextTitles[index], nextTitles[target]] = [nextTitles[target], nextTitles[index]];
    onChange(nextVideos, nextTitles);
  }

  function remove(index: number) {
    if (!window.confirm(`Remove the video "${videos[index].title || videos[index].vimeoId}" from this gallery?`)) return;
    onChange(videos.filter((_, i) => i !== index), titles.filter((_, i) => i !== index));
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      const { name } = await api.uploadPoster(galleryId, file);
      await onPosterUploaded();
      update(uploadFor.current, { poster: name });
      notify('Preview image uploaded. Save to keep the change.');
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  }

  return (
    <div className="video-list">
      <p className="muted small">
        Shown two per row on the gallery page. Vimeo only plays a video on the website if you allow it there: Vimeo →
        the video → Privacy → "Where can this be embedded?" → add gemycampei.com.
      </p>
      {videos.map((video, index) => (
        <div className="video-item form" key={index}>
          <div className="video-poster">
            {video.poster ? (
              <img src={photoUrl(galleryId, `posters/${video.poster}`, 400)} alt="" />
            ) : (
              <span className="note small">No preview image</span>
            )}
            <select value={video.poster} onChange={(e) => update(index, { poster: e.target.value })} aria-label="Preview image">
              <option value="">Choose a preview image …</option>
              {posters.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              className="small"
              onClick={() => {
                uploadFor.current = index;
                fileInput.current?.click();
              }}
            >
              Upload preview image …
            </button>
          </div>
          <div className="video-fields">
            <label>
              Vimeo address or number
              <input
                value={video.vimeoId}
                onChange={(e) => update(index, { vimeoId: vimeoNumber(e.target.value) })}
                placeholder="https://vimeo.com/1226323019"
              />
            </label>
            <label>
              Title
              <input value={video.title} onChange={(e) => update(index, { title: e.target.value })} placeholder="Anna & Max · Super 8 wedding film" />
            </label>
            {german && (
              <label>
                Titel (Deutsch)
                <input
                  value={titles[index]}
                  onChange={(e) => onChange(videos, titles.map((t, i) => (i === index ? e.target.value : t)))}
                />
              </label>
            )}
            <div className="list-actions">
              <button className="small" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                ↑
              </button>
              <button className="small" onClick={() => move(index, 1)} disabled={index === videos.length - 1} aria-label="Move down">
                ↓
              </button>
              <button className="small danger-outline" onClick={() => remove(index)}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}
      <button onClick={() => onChange([...videos, { vimeoId: '', title: '', poster: '' }], [...titles, ''])}>+ Add video</button>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => {
        upload(e.target.files?.[0]);
        e.target.value = '';
      }} />
    </div>
  );
}
