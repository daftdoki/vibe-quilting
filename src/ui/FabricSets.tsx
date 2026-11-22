/** One large card per fabric set, for the guide's first step and the fabric set sheet. */
import { sampleFabrics } from '../core/projectChoice';
import type { ProjectDef } from '../core/types';
import { Icon } from './Icon';

/** Thumbnails on each card. */
export const SET_THUMBS = 8;

interface Props {
  projects: readonly ProjectDef[];
  currentId: string;
  onPick(project: ProjectDef): void;
}

export function FabricSetCards({ projects, currentId, onPick }: Props) {
  return (
    <ul className="fabric-sets" role="radiogroup" aria-label="Fabric set">
      {projects.map((p) => {
        const on = p.id === currentId;
        const { collection } = p;
        const count = collection.fabrics.length;
        return (
          <li key={p.id}>
            <button
              type="button"
              role="radio"
              aria-checked={on}
              className={`fabric-set${on ? ' is-on' : ''}`}
              onClick={() => onPick(p)}
            >
              <span className="fabric-set-head">
                <span className="fabric-set-name">{collection.name}</span>
                {on && <Icon name="check" />}
              </span>
              <span className="fabric-set-meta">
                {collection.designer} · {count} {count === 1 ? 'fabric' : 'fabrics'}
              </span>
              <span className="fabric-set-thumbs" aria-hidden="true">
                {sampleFabrics(collection, SET_THUMBS).map((f) => (
                  <img key={f.id} src={f.thumb} alt="" loading="lazy" draggable={false} style={{ backgroundColor: f.color }} />
                ))}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
