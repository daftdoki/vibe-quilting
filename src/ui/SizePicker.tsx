import type { PatternDef } from '../core/types';
import { sizeGrid, sizeInches } from './format';
import { Icon } from './Icon';

interface Props {
  pattern: PatternDef;
  sizeId: string;
  onPick(sizeId: string): void;
}

export function SizePicker({ pattern, sizeId, onPick }: Props) {
  const block = pattern.block;
  return (
    <div className="sizes">
      <ul className="size-list" role="radiogroup" aria-label="Quilt size">
        {pattern.sizes.map((s) => {
          const on = s.id === sizeId;
          const w = s.cols * block.width;
          const h = s.rows * block.height;
          const k = Math.min(52 / w, 40 / h);
          return (
            <li key={s.id}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                className={`size-item${on ? ' is-on' : ''}`}
                onClick={() => onPick(s.id)}
              >
                <span className="size-glyph-box" aria-hidden="true">
                  <span
                    className="size-glyph"
                    style={{
                      width: `${w * k}px`,
                      height: `${h * k}px`,
                      backgroundSize: `${100 / s.cols}% ${100 / s.rows}%`,
                    }}
                  />
                </span>
                <span className="size-text">
                  <span className="size-name">{s.name}</span>
                  <span className="size-meta">
                    {sizeGrid(s)}, {sizeInches(pattern, s)}
                  </span>
                </span>
                {on && <Icon name="check" />}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="sizes-note">Each size keeps its own design.</p>
    </div>
  );
}
