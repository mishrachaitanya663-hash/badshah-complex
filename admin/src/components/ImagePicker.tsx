import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import Icon from './Icon';
import { toMessage } from '../utils';
import { ALLOWED_IMAGE_TYPES, formatBytes, MAX_INPUT_IMAGE_BYTES, prepareImage } from '../utils/image';

export type PendingImage = {
  id: string;
  file: File;
  preview: string;
  name: string;
  size: number;
  url?: string;
  uploading?: boolean;
};

type ReplaceTarget = { kind: 'pending'; id: string } | null;

type Props = {
  images: PendingImage[];
  onChange: Dispatch<SetStateAction<PendingImage[]>>;
  onUpload?: (file: File) => Promise<string>;
  savedImages?: string[];
  onRemoveSaved?: (index: number) => void;
  multiple?: boolean;
  maxImages?: number;
  hint?: string;
  sampleUrls?: string[];
  onUseSample?: (url: string) => void;
};

export default function ImagePicker({
  images,
  onChange,
  onUpload,
  savedImages = [],
  onRemoveSaved,
  multiple = false,
  maxImages = multiple ? 8 : 1,
  hint,
  sampleUrls = [],
  onUseSample,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const replaceTarget = useRef<ReplaceTarget>(null);
  const imagesRef = useRef(images);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => () => {
    imagesRef.current.forEach((image) => URL.revokeObjectURL(image.preview));
  }, []);

  function openPicker(target: ReplaceTarget = null) {
    replaceTarget.current = target;
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
  }

  function makeItem(file: File): PendingImage {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
    };
  }

  async function uploadItem(item: PendingImage) {
    if (!onUpload) return;
    onChange((current) => current.map((entry) => entry.id === item.id ? { ...entry, uploading: true } : entry));
    try {
      const url = await onUpload(item.file);
      onChange((current) => current.map((entry) => entry.id === item.id ? { ...entry, url, uploading: false } : entry));
    } catch (reason) {
      onChange((current) => current.map((entry) => entry.id === item.id ? { ...entry, uploading: false } : entry));
      setError(toMessage(reason));
    }
  }

  async function acceptFiles(files: File[]) {
    setError('');
    if (files.length === 0) return;

    const target = replaceTarget.current;
    replaceTarget.current = null;

    const prepared: PendingImage[] = [];
    for (const file of files) {
      try {
        prepared.push(makeItem(await prepareImage(file)));
      } catch (reason) {
        prepared.forEach((item) => URL.revokeObjectURL(item.preview));
        setError(toMessage(reason));
        return;
      }
    }

    let next = images;
    if (target?.kind === 'pending') {
      const old = images.find((item) => item.id === target.id);
      if (old) URL.revokeObjectURL(old.preview);
      next = images.filter((item) => item.id !== target.id);
    }

    const room = Math.max(0, maxImages - next.length);
    if (prepared.length > room) {
      prepared.forEach((item) => URL.revokeObjectURL(item.preview));
      setError(`You can add up to ${maxImages} image${maxImages === 1 ? '' : 's'}.`);
      return;
    }

    const chosen = multiple ? prepared : prepared.slice(0, 1);
    if (prepared.length > chosen.length) {
      prepared.slice(chosen.length).forEach((item) => URL.revokeObjectURL(item.preview));
    }
    onChange([...next, ...chosen]);
    chosen.forEach((item) => void uploadItem(item));
  }

  function removeItem(id: string) {
    const old = images.find((item) => item.id === id);
    if (old) URL.revokeObjectURL(old.preview);
    onChange((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="image-picker">
      <div
        className={`image-dropzone${dragging ? ' dragging' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => openPicker()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') openPicker();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void acceptFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <Icon name="image" size={26} />
        <strong>Tap to choose photos</strong>
        <small>Camera or gallery · JPEG, PNG, WebP, GIF</small>
        <small>{multiple ? 'Tap again to add more photos' : 'One photo per pick'}</small>
        <small>Max 25 MB input · optimized to 5 MB</small>
        {hint && <small>{hint}</small>}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(event) => {
            void acceptFiles(Array.from(event.target.files ?? []));
          }}
        />
      </div>

      {error && <p className="field-error">{error}</p>}
      <p className="field-hint">Allowed formats: {ALLOWED_IMAGE_TYPES.map((type) => type.split('/')[1]).join(', ')}.</p>

      {sampleUrls.length > 0 && onUseSample && (
        <div className="sample-options">
          <p className="field-hint">Or use a ready image</p>
          <div className="sample-picker compact">
            {sampleUrls.map((url) => (
              <button key={url} type="button" onClick={() => onUseSample(url)} aria-label={`Use ${url}`}>
                <img src={url} alt="" />
                <span>Use</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {images.length > 0 && (
        <div className="image-preview-grid">
          {images.map((image) => (
            <div className="image-preview-card" key={image.id}>
              <img src={image.preview} alt={image.name} />
              {image.uploading && <span className="image-badge">Uploading…</span>}
              {image.url && !image.uploading && <span className="image-badge ok">Saved</span>}
              <div className="image-preview-actions">
                <button type="button" onClick={() => openPicker({ kind: 'pending', id: image.id })}>Retake</button>
                <button type="button" onClick={() => openPicker({ kind: 'pending', id: image.id })}>Replace</button>
                <button type="button" className="danger" onClick={() => removeItem(image.id)}>Remove</button>
              </div>
              <small>{image.name} · {formatBytes(image.size)}</small>
            </div>
          ))}
        </div>
      )}

      {savedImages.length > 0 && (
        <div className="image-preview-grid saved">
          {savedImages.map((url, index) => (
            <div className="image-preview-card" key={`${url}-${index}`}>
              <img src={url} alt="" />
              <span className="image-badge ok">Saved</span>
              <div className="image-preview-actions">
                <button
                  type="button"
                  className="danger"
                  onClick={() => onRemoveSaved?.(index)}
                >
                  Remove
                </button>
              </div>
              <small>Stored on server</small>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && savedImages.length === 0 && (
        <p className="field-hint">No images selected yet.</p>
      )}
      <p className="field-hint">Large photos are resized only when needed, keeping quality as high as possible.</p>
      <p className="field-hint">Input limit: {formatBytes(MAX_INPUT_IMAGE_BYTES)}.</p>
    </div>
  );
}
