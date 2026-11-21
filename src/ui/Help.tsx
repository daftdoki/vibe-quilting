import { Icon, type IconName } from './Icon';

interface Topic {
  icon: IconName;
  title: string;
  steps: string[];
}

/**
 * The how-to reference. `wide` picks the wording for the side panel layout.
 * Every sentence here describes behavior the app has, so check it against the
 * code when that behavior changes.
 */
function topics(wide: boolean, pieceCount: number, letterRange: string): Topic[] {
  const stackPlace = wide
    ? 'The fat quarter stack is in the side panel, under the fabrics.'
    : 'Tap Fat quarters, under the quilt, to open the stack.';
  const blocksPlace = wide ? 'at the top of the screen' : 'under the quilt';
  const exportPlace = wide
    ? 'Tap Export PNG at the top, which is a download arrow on narrower screens, or open the three dots menu and tap Export PNG.'
    : 'Open the three dots menu at the top and tap Export PNG.';
  return [
    {
      icon: 'flag',
      title: 'Guided setup',
      steps: [
        'The guide takes an empty quilt to a finished design one step at a time. It starts on its own the first time you open a size.',
        'Size: pick a quilt size. If that size already has a design, you can start it empty or keep it and leave the guide.',
        'Fat quarters: tap fabrics to fill the stack in order. Dragging is off in this step. Tap any slot to make it the next one to fill, or to replace or clear it. Fill the rest for me picks fabrics for the empty slots.',
        'In this step, yellow outlines on the quilt show every piece the current fat quarter fills.',
        'If you tap Next while some fat quarters are still empty, the guide asks first. Fill the rest and go on fills them and moves on. Keep picking stays on the step.',
        wide
          ? 'Mix the order: tap Shuffle as often as you like. The fat quarter stack shows in the side panel during this step and the next, so you can watch the order change.'
          : 'Mix the order: tap Shuffle as often as you like.',
        'Turn and move blocks: pick Turn every other block or All the same way up, then tap blocks to swap or turn them.',
        'Touch-ups: the quilt zooms to one block at a time so you can paint pieces. Use Previous block and Next block, or Skip touch-ups.',
        'Your quilt is ready: export a picture, or tap Keep editing to close the guide.',
        'Back goes to the previous step and keeps your changes. Exit guide closes it at any step and leaves the quilt as it is.',
        'The guide remembers its step for each size, so a reload or a size switch picks up where you were.',
        'If any fat quarters are still empty after you leave the guide, a Finish setup button shows at the top left of the quilt. Tap it to go back to the fat quarters step.',
        'To open the guide again on the quilt you have, open the three dots menu and tap Resume the guide. It keeps the quilt as it is and opens at the fat quarters step if any are empty, otherwise at the shuffle step.',
        'To set up a size again from scratch, open the three dots menu and tap Start over with the guide. It empties the quilt first.',
      ],
    },
    {
      icon: 'paint',
      title: 'Place a fabric',
      steps: [
        'Tap a fabric, then tap each piece you want it on. The quilt gets a pink edge while you paint.',
        'To stop, tap the same fabric again or tap Done.',
        wide
          ? 'Or drag a fabric onto a piece. With a mouse, just drag. On a touch screen, move your finger sideways out of the list, or press and hold until the fabric lifts.'
          : 'Or drag a fabric onto a piece. Move your finger up out of the tray, or press and hold until the fabric lifts.',
        'The fabric floats above your finger. The yellow dot on it marks where it lands, and the piece under the dot gets a yellow outline.',
        wide
          ? 'Let go anywhere other than a piece or a fat quarter slot, or press Escape, to cancel the drag.'
          : 'Let go off the quilt, or press Escape, to cancel the drag.',
        wide
          ? 'Scroll the side panel to see every fabric.'
          : 'Swipe the tray sideways to see every fabric.',
        'The number on each fabric counts the pieces that use it. In the guide\'s fat quarters step it counts fat quarters instead.',
      ],
    },
    {
      icon: 'help',
      title: 'Look at a piece',
      steps: [
        'With no fabric selected, tap a piece. It gets a pink outline and the bar at the bottom of the quilt shows the fabric name, the piece letter, its row and block, and whether you placed it by hand.',
        'For a piece you placed by hand, Reset to shuffle puts back the fabric the shuffle gives it.',
        'Tap the piece again, tap the close button, or tap the mat around the quilt to hide it.',
      ],
    },
    {
      icon: 'square',
      title: 'Empty pieces',
      steps: [
        'A piece with no fabric yet is a plain violet patch with a dashed edge. Its letter shows once you zoom in far enough.',
        'A piece fills when its fat quarter in the stack gets a fabric. You can also paint or drop a fabric straight onto it.',
        'Empty pieces export as plain light patches.',
      ],
    },
    {
      icon: 'fit',
      title: 'Zoom and move',
      steps: [
        'Pinch to zoom. Move two fingers together to move the quilt while you zoom.',
        'Drag with one finger, or with the mouse, to move the quilt.',
        'On a computer, the scroll wheel, or two fingers on a trackpad, zooms in and out at the pointer. A trackpad pinch zooms too.',
        'Tap the corner button on the quilt, or double tap the mat around it, to fit the whole quilt on screen.',
        'The grid behind the quilt is in inches. Thin lines are 1 inch apart and show when you zoom in. Bold lines are 6 inches apart.',
      ],
    },
    {
      icon: 'stack',
      title: 'Fat quarter stack',
      steps: [
        stackPlace,
        `Each slot is one fat quarter, numbered in order from 1. Each one is cut into ${pieceCount} pieces, and the pattern's shuffle decides which block each piece goes into.`,
        `Slot numbers count fat quarters. Letters ${letterRange} name the piece positions inside a block, the letters shown on empty pieces when you zoom in.`,
        'When you tap a slot, yellow outlines on the quilt show every piece that fat quarter fills. Pieces you placed by hand are not outlined.',
        'Tap a slot, then tap a fabric below it to change that fat quarter.',
        'Tap a slot, then Clear to empty it. Empty slots have a dashed edge.',
        'Tap a slot, then tap a second slot to swap the two. Tap the same slot again to let go of it.',
        ...(wide ? ['You can also drag a fabric from the list onto a slot.'] : []),
        'Shuffle mixes the order. Empty slots stay where they are.',
        'When slots are empty, Fill the rest for me picks fabrics for them. It keeps the slots you filled, mixes designs side by side, and spaces out repeats.',
        'When the stack has more fat quarters than the collection has fabrics, some fabrics repeat.',
      ],
    },
    {
      icon: 'rotate',
      title: 'Move and turn blocks',
      steps: [
        `Switch from Fabrics to Blocks, ${blocksPlace}.`,
        'Tap a block, then tap another block to swap them. Each block keeps its fabrics.',
        'Tap the same block twice to turn it around. Tap Done to put it down.',
        wide
          ? 'While Blocks is on, the side panel shows Turn every other block and All the same way up. They are also in the guide\'s blocks step.'
          : 'While Blocks is on, Turn every other block and All the same way up show above the fabrics. They are also in the guide\'s blocks step.',
        'The one that matches the quilt exactly has a check mark. After you turn single blocks by hand, neither does.',
        'Reset blocks puts every block back in its place and turn. It is in the bar at the bottom of the quilt in Blocks, and in the three dots menu.',
      ],
    },
    {
      icon: 'ruler',
      title: 'Change the quilt size',
      steps: [
        'Tap the title at the top to pick a size.',
        'Each size shows its name, its grid of blocks, and its finished size in inches. The current one has a check mark.',
        'Each size keeps its own design, so you can switch back without losing anything.',
      ],
    },
    {
      icon: 'undo',
      title: 'Undo and redo',
      steps: [
        wide
          ? 'Undo and Redo at the top step back and forward through your changes. On narrower screens they show as arrows.'
          : 'The arrows at the top undo and redo your changes. A short note on the quilt says Undone or Redone each time.',
        'The first time each one can be used, it glows once.',
        'In the guide\'s Mix the order step, Undo sits beside Shuffle, so you can step back from a shuffle right there.',
        'Each size has its own undo history. It lasts until you reload the page.',
        'After a reload, open Versions to get back an earlier layout. The app saves an automatic version before each big change.',
      ],
    },
    {
      icon: 'versions',
      title: 'Versions',
      steps: [
        'A version is a saved copy of the quilt for this size. Save one to keep a layout while you try others.',
        wide
          ? 'Tap Versions at the top, or open the three dots menu, then tap Save a version. On a phone on its side, Versions is only in the three dots menu.'
          : 'Open the three dots menu and tap Save a version. It is named Version 1, Version 2 and so on.',
        'Save a version is off while the quilt is empty.',
        wide
          ? 'Versions, at the top or in the three dots menu, lists the saved versions for this size, newest first.'
          : 'Versions, in the three dots menu, lists the saved versions for this size, newest first.',
        'Each one shows a small picture, its name and when it was saved. Save a version is also at the top of the list.',
        'Restore puts a version back on the quilt. The app first saves what you had as an automatic version, and Undo also brings it back.',
        'The version that matches the quilt right now is marked Current, and its Restore button is off.',
        'Rename lets you type a new name of up to 40 characters. Enter or tapping elsewhere saves it, Escape cancels, and an empty name keeps the old one.',
        'Delete asks first. A deleted version cannot be brought back.',
        'Automatic versions have an Automatic tag. The app saves one before Shuffle, Reset to shuffle, Reset blocks, Turn every other block, All the same way up, Fill the rest for me, Start over with the guide, Start this size empty, and restoring a version.',
        'It skips an automatic version when the quilt is empty, when it matches the newest version, or when the same action repeats within a minute. A run of shuffles keeps the layout from before the first one.',
        'Each size keeps up to 30 versions you saved and 8 automatic ones. When there are more, the oldest of that kind goes.',
        'Versions belong to one size and are stored on this device only. If storage is full, the app says so and the version is not saved.',
        'A version that no longer fits this quilt cannot be restored.',
      ],
    },
    {
      icon: 'download',
      title: 'Saving and export',
      steps: [
        'Your work saves on this device as you go. It does not move to another phone or computer.',
        'Clearing the browser\'s data for this site removes your saved quilts and their versions.',
        'To keep a layout you like while you try others, save it as a version.',
        exportPlace,
        'Export makes a picture of the whole quilt. On a phone or tablet it opens the share sheet where it can. Otherwise the file downloads.',
      ],
    },
    {
      icon: 'reset',
      title: 'Resets',
      steps: [
        'Reset to shuffle, in the three dots menu, removes every fabric you placed by hand.',
        'Reset blocks puts every block back in its place and turn. The fat quarters and hand-placed fabrics stay.',
        'Start over with the guide empties the quilt, puts the blocks back, and starts the guide. Resume the guide keeps the quilt instead.',
        'Each of these saves an automatic version first, so you can restore the quilt from Versions even after a reload.',
        'Undo brings back what any reset changed.',
      ],
    },
    {
      icon: 'keyboard',
      title: 'Keyboard on a computer',
      steps: [
        'Tab moves between buttons and fabrics. Enter or Space picks the one in focus.',
        'Escape lets go of the fabric you are painting with, the piece you are looking at, and the block you picked up. It also closes an open sheet.',
        'Ctrl+Z or Cmd+Z undoes. Shift+Ctrl+Z, Shift+Cmd+Z, Ctrl+Y or Cmd+Y redoes.',
      ],
    },
    {
      icon: 'check',
      title: 'Good to know',
      steps: [
        'Prints are shown at their real size on the quilt.',
        'The exact spot each piece is cut from the print will differ when you sew it.',
        'A phone turned on its side is usually wide enough for the side panel layout.',
        'The first time you use the app, a tip at the bottom of the quilt explains painting. Got it hides it, and More tips opens this reference.',
      ],
    },
  ];
}

export function Help({ wide, pieceCount, letterRange }: { wide: boolean; pieceCount: number; letterRange: string }) {
  return (
    <div className="help">
      {topics(wide, pieceCount, letterRange).map((t, i) => (
        <details key={t.title} className="help-topic" open={i === 0}>
          <summary>
            <Icon name={t.icon} size={20} />
            <span>{t.title}</span>
            <span className="help-chevron" aria-hidden="true">
              <Icon name="chevron" size={18} />
            </span>
          </summary>
          <ul>
            {t.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
