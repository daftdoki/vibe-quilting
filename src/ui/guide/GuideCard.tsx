/**
 * The guide card. It sits above the tray in the narrow layout and at the top
 * of the side panel in the wide layout.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Icon } from '../Icon';
import { tapText } from '../pointerWords';
import { repeatedFabricBlocks } from '../../core/design';
import type { Design, FabricDef, PatternDef, ProjectDef, ResolvedPiece } from '../../core/types';
import type { GuideStepId } from '../../core/storage';
import type { CheckpointUpdate } from '../versions/useVersions';
import { BlocksStep, DoneStep, FabricsHow, FabricsStep, IntroStep, SizeStep, TouchupsStep } from './steps';
import { stepTitles } from './titles';
import { COUNTED_STEPS, type Guide } from './useGuide';

interface Props {
  guide: Guide;
  project: ProjectDef;
  /** Every fabric set. With more than one, the first step also picks the set. */
  projects: readonly ProjectDef[];
  /** Switch to another fabric set from the first step. */
  onPickProject(project: ProjectDef): void;
  design: Design;
  /** Applies a change after saving an automatic version. */
  checkpointUpdate: CheckpointUpdate;
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
  onPrint(): void;
  canPrint: boolean;
  /** The quilt's name, '' when it has none. */
  quiltName: string;
  onSaveName(name: string): void;
  onHelp(): void;
  /** Opens the picture of how a fat quarter is cut and shuffled. */
  onExplainFatQuarter(): void;
  onShuffle(): void;
  /** Fabrics she hid, for the fat quarters step. */
  excludedCount: number;
}


function instruction(step: GuideStepId, p: Props): string {
  const { guide, design, wide, activeName } = p;
  const n = design.lineup.length;
  switch (step) {
    case 'intro':
      return 'The guide walks you through it. Nothing is final, and you can change everything later.';
    case 'size':
      return p.projects.length > 1 ? 'Pick a fabric set, then a quilt size.' : 'Pick a quilt size.';
    case 'fabrics': {
      if (guide.hiding) {
        return wide
          ? 'Tap a fabric in the list below to exclude it. Tap an excluded one to bring it back.'
          : 'Tap a fabric at the bottom of the screen to exclude it. Tap an excluded one to bring it back.';
      }
      const where = wide ? 'in the list below' : 'below';
      const t = guide.targetSlot;
      if (t === null) return 'Every fat quarter is picked. Tap one to change it.';
      if (design.lineup[t] !== null) return `Tap a fabric ${where} to replace fat quarter ${t + 1}.`;
      return `Pick fat quarter ${t + 1} of ${n}. Tap a fabric ${where}.`;
    }
    case 'blocks':
      return 'Tap a block, then another to swap them. Tap the same block twice to turn it.';
    case 'touchups': {
      const head = `Block ${guide.block + 1} of ${guide.blockCount}.`;
      return activeName
        ? `${head} Tap pieces to paint them with ${activeName}. Tap the fabric again to stop.`
        : `${head} Tap a fabric, then tap a piece to change it.`;
    }
    case 'done':
      return 'Export a picture of it, save it to a file, print a build sheet to cut and sew from, or keep editing. Your work saves on this device as you go. A quilt file opens again here or on another device.';
  }
}

function tip(step: GuideStepId, wide: boolean, multiSets: boolean): string | null {
  switch (step) {
    case 'intro':
      return null;
    case 'size': {
      const size = 'Each size keeps its own design, and you can change size later by tapping the size at the top of the screen.';
      if (!multiSets) return size;
      const sets = wide
        ? 'Each fabric set keeps its own quilts, and a quilt uses one set. Change the set later with the set name at the top left, beside the size.'
        : 'Each fabric set keeps its own quilts, and a quilt uses one set. To change the set later, open the three dots menu and tap Fabric set.';
      return `${size} ${sets}`;
    }
    case 'fabrics':
      // This step is the fullest on a phone, so its zoom tip lives in the blocks step.
      return null;
    case 'blocks':
      return wide
        ? 'Pinch or use the scroll wheel to zoom, drag to move the quilt, and use the corner button to fit it back on screen.'
        : 'Pinch to zoom, drag to move the quilt, and tap the corner button to fit it back on screen.';
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
  const howId = useId();
  // The background notes for Pick your fabrics, closed until she asks.
  const [howOpen, setHowOpen] = useState(false);
  useEffect(() => setHowOpen(false), [guide.step, guide.hiding]);
  const step = guide.step;
  if (!step) return null;

  const index = COUNTED_STEPS.indexOf(step);
  const counter =
    index >= 0 ? `Step ${index + 1} of ${COUNTED_STEPS.length}` : step === 'intro' ? 'Before you start' : 'All set';
  const multiSets = props.projects.length > 1;
  const titles = stepTitles(multiSets);
  const tipText = tip(step, wide, multiSets);

  let body: ReactNode = null;
  switch (step) {
    case 'intro':
      body = <IntroStep onSkip={guide.exit} multi={multiSets} />;
      break;
    case 'size':
      body = (
        <SizeStep
          guide={guide}
          pattern={project.pattern}
          design={design}
          projects={props.projects}
          currentId={project.id}
          onPickProject={props.onPickProject}
        />
      );
      break;
    case 'fabrics':
      body = (
        <FabricsStep
          guide={guide}
          design={design}
          fabricsById={fabricsById}
          fabricCount={project.collection.fabrics.length}
          excludedCount={props.excludedCount}
          repeatBlocks={repeatedFabricBlocks(project.pattern, design.lineup, design.cells.length)}
          onRearrange={onShuffle}
        />
      );
      break;
    case 'blocks':
      body = <BlocksStep pattern={project.pattern} design={design} update={props.checkpointUpdate} />;
      break;
    case 'touchups':
      // Its buttons are the navigation row, drawn under the step counter below.
      body = null;
      break;
    case 'done':
      body = (
        <DoneStep
          wide={wide}
          multi={multiSets}
          exporting={exporting}
          onExport={onExport}
          onSaveQuilt={props.onSaveQuilt}
          canSaveQuilt={props.canSaveQuilt}
          onPrint={props.onPrint}
          canPrint={props.canPrint}
          quiltName={props.quiltName}
          onSaveName={props.onSaveName}
          onHelp={onHelp}
          onKeepEditing={guide.exit}
        />
      );
      break;
  }

  // Touch-ups and Done carry their own forward buttons. Touch-ups also carries Back, to save a row on a phone.
  const showNext = step !== 'touchups' && step !== 'done';

  return (
    <section className={`guide guide-${step}${step === 'fabrics' && guide.hiding ? ' is-hiding' : ''}`} aria-labelledby={titleId}>
      <div className="guide-head">
        <span className="guide-count">{counter}</span>
        <ol className="guide-progress" aria-hidden="true">
          {COUNTED_STEPS.map((s, i) => (
            <li key={s} className={i < index || step === 'done' ? 'is-past' : i === index ? 'is-now' : ''} />
          ))}
        </ol>
        <button type="button" className="btn btn-small btn-text guide-exit" onClick={guide.exit}>
          Exit guide
        </button>
      </div>

      {/* Back and Next sit under the step counter, where they are seen first. Touch-ups brings its own row. */}
      {step === 'touchups' ? (
        <TouchupsStep guide={guide} />
      ) : step === 'intro' ? (
        // Start sits where Next does on the other steps, so it shows without scrolling on a phone.
        <div className="guide-nav">
          <button type="button" className="btn btn-small btn-ghost" onClick={onHelp}>
            <Icon name="help" size={18} />
            How to use
          </button>
          <button type="button" className="btn btn-small btn-primary guide-next" onClick={guide.next}>
            Start
            <Icon name="arrowRight" size={18} />
          </button>
        </div>
      ) : step === 'fabrics' && guide.hiding ? null : (
        <div className="guide-nav">
          {/* Quilt size goes back to the overview. Only the overview has no Back. */}
          <button type="button" className="btn btn-small guide-back" onClick={guide.back}>
            <Icon name="arrowLeft" size={18} />
            Back
          </button>
          {showNext && (
            <button type="button" className="btn btn-small btn-primary guide-next" onClick={guide.next}>
              Next
              <Icon name="arrowRight" size={18} />
            </button>
          )}
        </div>
      )}

      <div className="guide-title-row">
        <h2 id={titleId} className="guide-title">
          {step === 'fabrics' && guide.hiding ? 'Exclude fabrics' : titles[step]}
        </h2>
        {step === 'fabrics' && !guide.hiding && (
          <button
            type="button"
            className="guide-how-btn"
            aria-expanded={howOpen}
            aria-controls={howId}
            onClick={() => setHowOpen((o) => !o)}
          >
            <Icon name="help" size={18} />
            How it works
            <span className="guide-how-chevron" aria-hidden="true">
              <Icon name="chevron" size={16} />
            </span>
          </button>
        )}
      </div>
      {step === 'fabrics' && !guide.hiding && howOpen && (
        <FabricsHow
          id={howId}
          slotCount={design.lineup.length}
          fabricCount={project.collection.fabrics.length}
          excludedCount={props.excludedCount}
          cutLine={cutLine(project.pattern, props.slotPieces)}
          onExplain={props.onExplainFatQuarter}
        />
      )}
      <div className="guide-text" aria-live="polite">
        {/* In the hide mode the mode's instruction takes the place of this lead, so the card does not grow. */}
        {step === 'fabrics' && !guide.hiding && (
          <p>
            Pick each fabric yourself, let the app pick at random, or do some of each. Exclude any fabric you do not want
            and the app will not pick it.
          </p>
        )}
        {/* Why the step is worth doing, and what to aim for. */}
        {step === 'blocks' && (
          <p>
            This is where you balance the quilt. Turning every other block, as the pattern suggests, stops the same
            shapes lining up from block to block. Move a block when two alike fabrics sit side by side, or one area
            looks too dark or too busy. Aim for the colours to look evenly spread.
          </p>
        )}
        {step === 'touchups' && (
          <p>
            This step is optional. It goes through the quilt one block at a time so you can change a single piece,
            for example where two alike fabrics touch or one piece stands out too much. Each change swaps just that
            piece. Skip it if you are happy with the quilt.
          </p>
        )}
        <p>{tapText(instruction(step, props))}</p>
      </div>

      {body}

      {tipText && (
        <p className="guide-tip">
          <span className="guide-tip-label">Tip</span> {tapText(tipText)}
        </p>
      )}

    </section>
  );
}
