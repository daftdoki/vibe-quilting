/** The list of saved versions for the current size, with save, restore, rename and delete. */
import { useEffect, useRef, useState } from 'react';
import type { DesignVersion, ProjectDef } from '../../core/types';
import { MAX_VERSION_NAME } from '../../core/versions';
import { savedWhen } from '../format';
import { Icon } from '../Icon';
import { VersionThumb } from './VersionThumb';
import type { Versions } from './useVersions';

interface Props {
  project: ProjectDef;
  sizeName: string;
  versions: Versions;
  onSave(): void;
  /** Called after a version replaces the live design. */
  onRestored(name: string): void;
}

export function VersionsList({ project, sizeName, versions, onSave, onRestored }: Props) {
  const now = Date.now();
  return (
    <div className="versions">
      <p className="versions-note">
        Versions belong to the {sizeName.toLowerCase()} size and are stored on this device. Save quilt file and Export data, in the three dots menu, take them along.
      </p>
      <div className="versions-save">
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={!versions.canSave}>
          <Icon name="save" />
          Save a version
        </button>
        {!versions.canSave && <p className="versions-hint">The quilt is empty, so there is nothing to save yet.</p>}
      </div>

      {versions.list.length === 0 ? (
        <p className="versions-empty">
          Save a version to keep this layout while you try others. You can go back to it at any time.
        </p>
      ) : (
        <ul className="version-list">
          {versions.list.map((v) => (
            <VersionItem
              key={v.id}
              project={project}
              version={v}
              now={now}
              current={versions.isCurrent(v)}
              onRestore={() => {
                if (versions.restore(v.id)) onRestored(v.name);
              }}
              onRename={(name) => versions.rename(v.id, name)}
              onDelete={() => versions.remove(v.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function VersionItem({
  project,
  version: v,
  now,
  current,
  onRestore,
  onRename,
  onDelete,
}: {
  project: ProjectDef;
  version: DesignVersion;
  now: number;
  current: boolean;
  onRestore(): void;
  onRename(name: string): void;
  onDelete(): void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(v.name);
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLButtonElement>(null);
  const done = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    if (save) onRename(draft);
    setEditing(false);
    // Put focus back where the rename started.
    requestAnimationFrame(() => renameRef.current?.focus());
  };

  const showReason = v.auto && v.reason && v.reason !== v.name;

  return (
    <li className={`version${current ? ' is-current' : ''}`}>
      <VersionThumb project={project} design={v.design} label={v.name} />
      <div className="version-body">
        {editing ? (
          <input
            ref={inputRef}
            className="version-input"
            value={draft}
            maxLength={MAX_VERSION_NAME}
            aria-label="Version name"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                finish(true);
              } else if (e.key === 'Escape') {
                // Keep the sheet open; Escape only cancels the rename.
                e.preventDefault();
                e.stopPropagation();
                finish(false);
              }
            }}
            onBlur={() => finish(true)}
          />
        ) : (
          <strong className="version-name">{v.name}</strong>
        )}
        <span className="version-meta">
          {savedWhen(v.createdAt, now)}
          {v.auto && <span className="version-tag">Automatic</span>}
          {showReason && <span>{v.reason}</span>}
          {current && <span className="version-current">Current</span>}
        </span>

        {confirming ? (
          <div className="version-confirm" role="group" aria-label={`Delete ${v.name}`}>
            <p>Delete {v.name}? This cannot be undone.</p>
            <div className="version-actions">
              <button type="button" className="btn btn-small btn-danger" onClick={onDelete}>
                Delete
              </button>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirming(false)}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <div className="version-actions">
            <button
              type="button"
              className="btn btn-small"
              onClick={onRestore}
              disabled={current}
              aria-label={`Restore ${v.name}`}
            >
              Restore
            </button>
            <button
              ref={renameRef}
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => {
                done.current = false;
                setDraft(v.name);
                setEditing(true);
              }}
              aria-label={`Rename ${v.name}`}
            >
              Rename
            </button>
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => setConfirming(true)}
              aria-label={`Delete ${v.name}`}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
