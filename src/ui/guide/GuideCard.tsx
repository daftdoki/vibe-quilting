/**
 * The guide card. It sits above the tray in the narrow layout and at the top
 * of the side panel in the wide layout.
 */
import { useId, type ReactNode } from 'react';
import { repeatedFabricBlocks } from '../../core/design';
import type { Design, FabricDef, PatternDef, ProjectDef, ResolvedPiece } from '../../core/types';
import type { GuideStepId } from '../../core/storage';
import type { CheckpointUpdate } from '../versions/useVersions';
import { BlocksStep, DoneStep, FabricsStep, ShuffleStep, SizeStep, TouchupsStep } from './steps';
import { COUNTED_STEPS, type Guide } from './useGuide';

interface Props {
  guide: Guide;
  project: ProjectDef;
  design: Design;
  /** Applies a change after saving an automatic version. */
  checkpointUpdate: CheckpointUpdate;
  canUndo: boolean;
  onUndo(): void;
  fabricsById: ReadonlyMap<string, FabricDef>;
  /** Name of the fabric picked for painting, if any. */
  activeName: string | null;
  /** Every piece the target slot fills, hand-placed ones included, for the fat quarters step. */
  slotPieces: readonly ResolvedPiece[];
  wide: boolean;
  exporting: boolean;
  onExport(): void;
  onSaveQuilt(): void;
  canSaveQuilt: boolean;
  onHelp(): void;
  /** Opens the picture of how a fat quarter is cut and shuffled. */
  onExplainFatQuarter(): void;
  onShuffle(): void;
}

const TITLES: Record<GuideStepId, string> = {
  size: 'Quilt size',
  fabrics: 'Pick your fabrics',
  shuffle: 'Mix the order',
  blocks: 'Turn and move blocks',
  touchups: 'Touch-ups',
  done: 'Your quilt is ready',
};

function instruction(step: GuideStepId, p: Props): string {
  const { guide, design, wide, activeName } = p;
  const n = design.lineup.length;
  switch (step) {
    case 'size':
      return 'Pick a quilt size.';
    case 'fabrics': {
      const where = wide ? 'in the list below' : 'below';
      const t = guide.targetSlot;
      if (t === null) return 'Every fat quarter is picked. Tap one to change it.';
      if (design.lineup[t] !== null) return `Tap a fabric ${where} to replace fat quarter ${t + 1}.`;
      return `Pick fat quarter ${t + 1} of ${n}. Tap a fabric ${where}.`;
    }
    case 'shuffle':
      return 'Shuffle as often as you like. Each fat quarter lands in a different spot in every block.';
    case 'blocks':
      return 'Tap a block, then another to swap them. Tap the same block twice to turn it.';
    case 'touchups': {
      const head = `Block ${guide.block + 1} of ${guide.blockCount}.`;
      return activeName
        ? `${head} Tap pieces to paint them with ${activeName}. Tap the fabric again to stop.`
        : `${head} Tap a fabric, then tap a piece to change it.`;
    }
    case 'done':
      return 'Export a picture of it, save it to a file, or keep editing. Your work saves on this device as you go. A quilt file opens again here or on another device.';
  }
}

function tip(step: GuideStepId, wide: boolean): string | null {
  switch (step) {
    case 'size':
      return 'Each size keeps its own design, and you can change size later by tapping the title at the top.';
    case 'fabrics':
      return wide
        ? 'Pinch or use the scroll wheel to zoom, drag to move the quilt, and use the corner button to fit it back on screen.'
        : 'Pinch to zoom, drag to move the quilt, and tap the corner button to fit it back on screen.';
    case 'shuffle':
      return wide
        ? 'Undo and Redo at the top work on every change you make, not only a shuffle.'
        : 'The arrows at the top undo and redo every change you make, not only a shuffle.';
    case 'blocks':
      return wide
        ? 'This works outside the guide too, under Blocks at the top.'
        : 'This works outside the guide too, under Blocks above the fabrics.';
    case 'touchups':
      return 'You can also drag a fabric onto a piece, and a tap on a piece with no fabric picked shows what it is and can put the shuffled fabric back.';
    case 'done':
      return null;
  }
}

/**
 * One line on how a fat quarter is cut, worded from what the pattern does with
 * the target slot. The letters only show when it fills one piece of each.
 */
function cutLine(pattern: PatternDef, pieces: readonly ResolvedPiece[]): string | null {
  if (pieces.length === 0) return null;
  const defs = pattern.block.pieces;
  const letters = new Set(pieces.map((p) => p.pieceIndex));
  const blocks = new Set(pieces.map((p) => p.blockId));
  const outline = 'The yellow outlines show where this one goes.';
  if (pieces.length === defs.length && letters.size === defs.length && blocks.size === defs.length) {
    const first = defs[0]?.label ?? '';
    const last = defs[defs.length - 1]?.label ?? '';
    return `Each fat quarter is cut into ${defs.length} pieces, ${first} to ${last}, each in a different block. ${outline}`;
  }
  const n = pieces.length;
  return `This fat quarter is cut into ${n} ${n === 1 ? 'piece' : 'pieces'}. ${outline}`;
}

export function GuideCard(props: Props) {
  const { guide, project, design, fabricsById, wide, exporting, onExport, onHelp, onShuffle } = props;
  const titleId = useId();
  const step = guide.step;
  if (!step) return null;

  const index = COUNTED_STEPS.indexOf(step);
  const counter = index >= 0 ? `Step ${index + 1} of ${COUNTED_STEPS.length}` : 'All set';
  const tipText = tip(step, wide);

  let body: ReactNode = null;
  switch (step) {
    case 'size':
      body = <SizeStep guide={guide} pattern={project.pattern} design={design} />;
      break;
    case 'fabrics':
      body = (
        <FabricsStep
          guide={guide}
          design={design}
          fabricsById={fabricsById}
          fabricCount={project.collection.fabrics.length}
          cutLine={cutLine(project.pattern, props.slotPieces)}
          repeatBlocks={repeatedFabricBlocks(project.pattern, design.lineup, design.cells.length)}
          onExplain={props.onExplainFatQuarter}
        />
      );
      break;
    case 'shuffle':
      body = (
        <ShuffleStep
          onShuffle={onShuffle}
          disabled={design.lineup.filter((id) => id !== null).length < 2}
          onUndo={props.onUndo}
          canUndo={props.canUndo}
        />
      );
      break;
    case 'blocks':
      body = <BlocksStep pattern={project.pattern} design={design} update={props.checkpointUpdate} />;
      break;
    case 'touchups':
      body = <TouchupsStep guide={guide} />;
      break;
    case 'done':
      body = (
        <DoneStep
          wide={wide}
          exporting={exporting}
          onExport={onExport}
          onSaveQuilt={props.onSaveQuilt}
          canSaveQuilt={props.canSaveQuilt}
          onHelp={onHelp}
          onKeepEditing={guide.exit}
        />
      );
      break;
  }

  // Touch-ups and Done carry their own forward buttons. Touch-ups also carries Back, to save a row on a phone.
  const showNext = step !== 'touchups' && step !== 'done';
  const nextReady = step !== 'fabrics' || guide.emptySlots === 0;

  return (
    <section className={`guide guide-${step}`} aria-labelledby={titleId}>
      <div className="guide-head">
        <span className="guide-count">{counter}</span>
        <ol className="guide-progress" aria-hidden="true">
          {COUNTED_STEPS.map((s, i) => (
            <li key={s} className={i < index || index < 0 ? 'is-past' : i === index ? 'is-now' : ''} />
          ))}
        </ol>
        <button type="button" className="btn btn-small btn-text guide-exit" onClick={guide.exit}>
          Exit guide
        </button>
      </div>

      <h2 id={titleId} className="guide-title">
        {TITLES[step]}
      </h2>
      <div className="guide-text" aria-live="polite">
        <p>{instruction(step, props)}</p>
      </div>

      {body}

      {tipText && (
        <p className="guide-tip">
          <span className="guide-tip-label">Tip</span> {tipText}
        </p>
      )}
      {step === 'size' && (
        <p className="guide-tip">The full how to use guide is always under the ? button and in the three dots menu.</p>
      )}

      {step !== 'touchups' && (
        <div className="guide-nav">
          {step !== 'size' && (
            <button type="button" className="btn btn-small btn-ghost" onClick={guide.back}>
              Back
            </button>
          )}
          {showNext && (
            <button
              type="button"
              className={`btn btn-small ${nextReady ? 'btn-primary' : 'btn-muted'}`}
              onClick={guide.next}
            >
              Next
            </button>
          )}
        </div>
      )}
    </section>
  );
}
