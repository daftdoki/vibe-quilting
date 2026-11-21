import type { PatternDef } from '../core/types';
import { FatQuarterDiagram } from './FatQuarterDiagram';
import { Icon, type IconName } from './Icon';

interface Topic {
  icon: IconName;
  title: string;
  steps: string[];
  /** Shows the fat quarter picture above the steps. */
  figure?: boolean;
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
  const menuPlace = wide
    ? 'Save & export, at the top next to Versions, opens a short menu. On narrower screens it shows as a file icon with a small arrow.'
    : 'Open the three dots menu at the top. Save & export is near the top of the menu.';
  const exportPlace = wide
    ? 'To export a picture, open Save & export at the top and tap Export PNG.'
    : 'To export a picture, open the three dots menu and tap Export PNG, under Save & export.';
  return [
    {
      icon: 'flag',
      title: 'Guided setup',
      steps: [
        'The guide takes an empty quilt to a finished design one step at a time. It starts on its own the first time you open a size.',
        wide
          ? 'The guide card sits at the top of the side panel. It has five steps and a closing step, and the counter at its top says which step you are on.'
          : 'The guide card sits under the quilt, above the fabrics. It has five steps and a closing step, and the counter at its top says which step you are on.',
        wide
          ? 'While the guide is open, the Fabrics and Blocks switch at the top is hidden, and the fat quarter stack shows only in Mix the order and Turn and move blocks. Each step shows the controls it needs.'
          : 'While the guide is open, the Fabrics and Blocks switch and the Fat quarters button are hidden. Each step shows the controls it needs.',
        'Quilt size: pick a quilt size. If that size already has a design, you can tap Start this size empty, or Keep it and exit the guide.',
        'Pick your fabrics: tap fabrics to fill the stack of fat quarters in order. Dragging is off in this step. Tap any slot to make it the next one to fill, or to replace or clear it. Pick at random replaces every fat quarter with a random mix of fabrics each time you tap it, so tap it again to see another mix. Fill the rest for me keeps the fat quarters you picked and fills only the empty ones. It shows only while some are empty. Clear picks, beside it, empties every fat quarter so you can pick again. It shows once you have picked at least one. Undo brings them back.',
        'At the top, the step says you can pick each fabric yourself, let the app pick at random, or do some of each.',
        'Hide a fabric, in the same step, is for fabrics you do not want. Tap it and the list shows every fabric, with hidden ones grey and crossed out. Tap a fabric to hide it, and tap a hidden one to bring it back. Tap Done when you are finished. Escape, Next, Back and Exit guide end it too.',
        'A hidden fabric is not in the fabric list or the fat quarter stack\'s fabric picker, so it cannot be picked, painted or dragged. When any are hidden, the step says how many, with Show them to see them again and bring them back.',
        'Hiding a fabric takes it off the quilt you have open. The fat quarters that held it become empty, and pieces you placed by hand with it go back to the shuffle. Quilts in other sizes keep it, but the list applies to every size, so Pick at random and Fill the rest for me never choose it in any size. Undo brings the quilt back, but the fabric stays hidden. You cannot hide the last fabric.',
        'In this step, yellow outlines on the quilt show every piece the current fat quarter fills, except pieces you placed by hand.',
        'If you tap Next while some fat quarters are still empty, the guide asks first. Fill the rest and go on fills them and moves on. Keep picking stays on the step.',
        wide
          ? 'Mix the order: tap Shuffle as often as you like. Shuffle is off until at least 2 fat quarters have a fabric. The fat quarter stack shows in the side panel during this step and the next, so you can watch the order change.'
          : 'Mix the order: tap Shuffle as often as you like. Shuffle is off until at least 2 fat quarters have a fabric.',
        'Turn and move blocks: pick Turn every other block or All the same way up, then tap blocks to swap or turn them.',
        'Touch-ups: the quilt zooms to one block at a time so you can paint pieces. Use Previous block and Next block, or Skip touch-ups. On the last block, Next block becomes Finish. These buttons are in one row under the step counter, with Back.',
        'Your quilt is ready: export a picture, save a quilt file, print a build sheet, or tap Keep editing to close the guide. A list shows where things are once the guide is closed.',
        'Back and Next are near the top of the guide card, under the step counter. Back is white with an arrow pointing left, and Next is yellow with an arrow pointing right. Back goes to the previous step and keeps your changes. The first step has no Back. Next is not shown on Touch-ups or on the last screen, which have their own buttons. Exit guide, at the top right of the card, closes it at any step and leaves the quilt as it is.',
        'The guide remembers its step for each size, so a reload or a size switch picks up where you were.',
        'If any fat quarters are still empty after you leave the guide, a Finish setup button shows at the top left of the quilt. Tap it to go back to the Pick your fabrics step.',
        'To open the guide again on the quilt you have, open the three dots menu and tap Resume the guide. It keeps the quilt as it is and opens at Pick your fabrics if any fat quarters are empty, otherwise at Mix the order. It is not in the menu while the guide is open.',
        'To set up a size again from scratch, tap Start fresh at the top left of the quilt. It is also in the three dots menu. It empties the quilt for the size you have open and starts the guide. Other sizes are not touched.',
        'The Start fresh button on the quilt shows only while the quilt has a fabric on it. In the three dots menu, Start fresh also works on an empty quilt that has saved versions. It is off only when the quilt is empty and the size has no versions.',
        'Start fresh asks first. If this size has saved versions, you can tick a box to delete them too. Undo brings back the quilt, but not deleted versions.',
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
        'The number on each fabric counts the pieces that use it. In the guide\'s Pick your fabrics step it counts fat quarters instead.',
        'A fabric you hid does not show in the list, so it cannot be painted or dragged.',
        wide
          ? 'To hide a fabric or bring one back, use Hide a fabric in the guide\'s Pick your fabrics step. There every fabric shows, and a hidden one is grey and crossed out, with Hidden under its name and no number. Hiding also takes the fabric off the quilt you have open, and the list applies to every size. To get there, open the three dots menu, tap Resume the guide, and tap Back if it opens at Mix the order.'
          : 'To hide a fabric or bring one back, use Hide a fabric in the guide\'s Pick your fabrics step. There every fabric shows, and a hidden one is grey and crossed out, with no number. Hiding also takes the fabric off the quilt you have open, and the list applies to every size. To get there, open the three dots menu, tap Resume the guide, and tap Back if it opens at Mix the order.',
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
        'Pinch to zoom. Slide both fingers the same way to move the quilt while you zoom.',
        'Drag with one finger, or with the mouse, to move the quilt.',
        'On a computer, the scroll wheel, or two fingers on a trackpad, zooms in and out at the pointer. A trackpad pinch zooms too.',
        'Tap the fit button at the top right corner of the quilt, or double tap the mat around it, to fit the whole quilt on screen.',
        'The grid behind the quilt is in inches. Thin lines are 1 inch apart and show when you zoom in. Bold lines are 6 inches apart.',
      ],
    },
    {
      icon: 'stack',
      title: 'Fat quarter stack',
      figure: true,
      steps: [
        `The picture shows one fat quarter cut into its ${pieceCount} pieces, and where those pieces end up after the shuffle. In the guide's Pick your fabrics step, See how a fat quarter is used opens the same picture with a few lines about it.`,
        `A block is ${pieceCount} pieces sewn together, one for each letter, and each comes from a different fat quarter. A quilt needs one fat quarter for every block.`,
        `On a size with fewer than ${pieceCount} fat quarters, a block has more than one piece from the same fat quarter.`,
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
        'When the stack has more fat quarters than there are fabrics you have not hidden, some fabrics repeat. The guide\'s Pick your fabrics step says so.',
        'If your picks put the same fabric twice in one block, a note in the stack and in the guide\'s Pick your fabrics step says how many blocks are affected. It is only a heads-up. Change or move a fat quarter to spread them out, or leave it. The note does not count pieces you placed by hand, and it does not show on a size with fewer fat quarters than a block has pieces, where repeats cannot be avoided.',
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
          ? 'While Blocks is on, the side panel shows Turn every other block and All the same way up. They are also in the guide\'s Turn and move blocks step.'
          : 'While Blocks is on, Turn every other block and All the same way up show above the fabrics. They are also in the guide\'s Turn and move blocks step.',
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
        'The first time each one can be used after you open the app, it glows once.',
        'In the guide\'s Mix the order step, Undo sits beside Shuffle, so you can step back from a shuffle right there.',
        'Undo covers changes to the quilt: fabrics on pieces, the fat quarter stack, and blocks. It does not undo saving, renaming or deleting a version, a size switch, or hiding a fabric. After hiding a fabric, Undo brings back the quilt, but the fabric stays hidden.',
        'Each size has its own undo history of up to 99 changes. It lasts until you reload the page.',
        'After a reload, open Versions to get back an earlier layout. The app saves an automatic version before each big change.',
      ],
    },
    {
      icon: 'versions',
      title: 'Versions',
      steps: [
        'A version is a saved copy of the quilt for this size. Save one to keep a layout while you try others.',
        wide
          ? 'Tap Versions at the top, or open the three dots menu, then tap Save a version. It is named Version 1, Version 2 and so on. On narrower screens the Versions button shows as an icon. On the narrowest, such as some phones on their side, it is hidden and Versions is only in the three dots menu.'
          : 'Open the three dots menu and tap Save a version. It is named Version 1, Version 2 and so on.',
        'Save a version is off while the quilt is empty.',
        wide
          ? 'Versions, at the top or in the three dots menu, lists the saved versions for this size, newest first.'
          : 'Versions, in the three dots menu, lists the saved versions for this size, newest first.',
        'Each one shows a small picture, its name and when it was saved. Save a version is also at the top of the list.',
        'The three dots menu says how many versions this size has.',
        'Restore puts a version back on the quilt. The app first saves what you had as an automatic version, and Undo also brings it back.',
        'The version that matches the quilt right now is marked Current, and its Restore button is off.',
        'Rename lets you type a new name of up to 40 characters. Enter or tapping elsewhere saves it, Escape cancels, and an empty name keeps the old one.',
        'Delete asks first. A deleted version cannot be brought back.',
        'Automatic versions have an Automatic tag and are named for the action, such as Before shuffle. The app saves one before Shuffle, Reset to shuffle in the three dots menu, Reset blocks, Turn every other block, All the same way up, Pick at random, Fill the rest for me, Fill the rest and go on, Clear picks, hiding a fabric the quilt uses, Start fresh, Start this size empty, restoring a version, and opening a quilt file.',
        'Reset to shuffle for a single piece, in the bar at the bottom of the quilt, does not save one. Undo brings that piece back.',
        'Start fresh does not save an automatic version when you tick the box to delete this size\'s versions.',
        'It skips an automatic version when the action changes nothing, when the quilt is empty, when it matches the newest version, or when the newest version is an automatic one from the same action less than a minute ago. A run of shuffles keeps the layout from before the first one.',
        'Each size keeps up to 30 versions you saved and 8 automatic ones. When there are more, the oldest of that kind goes.',
        'Versions belong to one size and are stored on this device. Save quilt file takes this size\'s versions along, and Export data takes all of them. If storage is full, the app says so and the version is not saved.',
        'If a version uses a fabric this app no longer has, it restores with those spots empty.',
      ],
    },
    {
      icon: 'download',
      title: 'Saving and export',
      steps: [
        'Your work saves on this device as you go. To move it to another phone, tablet or computer, use Save quilt file or Export data. See Save, back up and move your quilts.',
        'Clearing the browser\'s data for this site removes your saved quilts and their versions.',
        'To keep a layout you like while you try others, save it as a version.',
        menuPlace,
        'Save & export has four actions. Save quilt file and Open a quilt file save the quilt to a file and bring one back. Export PNG makes a picture. Print build sheet opens a black and white sheet to cut and sew from. See Print a build sheet.',
        exportPlace,
        'Export PNG makes a picture of the quilt you have open. On a phone or tablet it opens the share sheet where it can. Otherwise the file downloads. A picture cannot be opened again for editing. To keep the quilt itself, use Save quilt file.',
      ],
    },
    {
      icon: 'print',
      title: 'Print a build sheet',
      steps: [
        wide
          ? 'Open Save & export at the top and tap Print build sheet. The guide\'s last step has a Print build sheet button too.'
          : 'Open the three dots menu and tap Print build sheet, under Save & export. The guide\'s last step has a Print build sheet button too.',
        'It is off while the quilt is empty.',
        'The build sheet is a reference to cut and sew from. It opens as a preview of the pages. Tap Print to print them, and Close or Escape to go back to the quilt.',
        'It prints in black and white with thin lines and no fabric pictures, so it uses little ink. Numbers stand for fabrics. Write each number on its fat quarter before you cut.',
        'Page 1 starts with the size, the finished size, the grid of blocks, how many fat quarters to buy, and the date. It lists the fabrics by number with name, SKU and how many fat quarters to buy, with a box to tick when you have each one. Then comes the stacking order: the order to pile the fat quarters before you cut, with number 1 on top.',
        'Then there is one card per block, in block number order. Each card draws the block the same way up, with the fabric number in each piece and the piece letter in its top left corner. A number you placed by hand is underlined, and the card says which pieces changed. An empty piece shows a dash. Each card has a Sewn box to tick.',
        'Large cards fit 4 to a page. Compact cards fit 9 to a page and use less paper. Pick one at the top of the preview.',
        'On its own page after the cards, a map shows where each block goes, with Row 1 at the top. Each block has its number in the middle. Only its first piece is drawn, with its letter, to show which way up to turn the block. If you placed pieces by hand, a table lists them.',
        'If you placed one fabric on more pieces of one letter than its fat quarters give, the sheet says how many more fat quarters of it to buy. A fat quarter gives one piece of each letter.',
        'To keep a copy, pick Save as PDF in your printer choices. The preview stays open after a reload until you close it.',
      ],
    },
    {
      icon: 'fileUp',
      title: 'Save, back up and move your quilts',
      steps: [
        'There are three ways to save. Export PNG is a picture and cannot be opened again. Save quilt file is the quilt for the size you have open, to open again here or on another device. Export data is everything.',
        wide
          ? 'Open Save & export at the top and tap Save quilt file. The guide\'s last step has it too.'
          : 'Open the three dots menu and tap Save quilt file, under Save & export. The guide\'s last step has it too.',
        wide
          ? 'Open a quilt file, in Save & export, opens a quilt file or a full export. It does the same as Import data in the three dots menu.'
          : 'Open a quilt file, under Save & export in the three dots menu, opens a quilt file or a full export. It does the same as Import data.',
        'Save quilt file makes one file with the quilt for the size you have open, all its saved versions, and where you were in the guide. It is named vibe-quilting, the size, then the date. It is off while the quilt is empty and the size has no versions.',
        'Open the three dots menu. Your data is at the bottom, with Export data, Import data and Clear all data.',
        'Export data saves one file with everything: the quilt for every size, all your saved versions, where you were in the guide, and the fabrics you hid. It is named vibe-quilting, then the date.',
        'On a phone or tablet, Save quilt file and Export data open the share sheet where it can, so you can save the file to Files, AirDrop it, or send it to yourself. Otherwise the file downloads. Keep it somewhere safe as a backup.',
        'To move to another device, save a file on the first one. Send the file to yourself, or save it where both devices can reach it. On the other device, open the three dots menu, tap Import data and pick the file. Import data opens either kind of file.',
        'Opening a quilt file replaces only that one size. The quilt you had in that size is kept as an automatic version called Before opening a file. It is not kept if that size was empty, already held the same quilt, or matches its newest version. The versions in the file are added to yours, without copies. The other sizes are not touched, and the fabrics you hid stay hidden. The app then reloads on that size. You can undo it by restoring that automatic version from Versions.',
        'A full export is different. Import data replaces everything on the device you run it on. The quilts and versions there are erased, and it cannot be undone. The app shows what the file holds and what will be erased before it does anything.',
        'For a full export, you can tap Export my data first on the confirm screen to keep what is on that device. It saves a file of the current data, and the confirm screen stays open.',
        'After a full import the app reloads and opens the size that was open when the file was exported.',
        'Files exported by older versions of the app keep working. A file from a newer version imports everything this version understands, and the confirm screen says how many quilts and versions it will skip.',
        'If a fabric in the file is not in this app, the confirm screen says so, and the spots that used it open with no fabric. You can paint them again. If a quilt\'s blocks no longer fit, they go back to their starting places, and the confirm screen says that too.',
        'Import refuses a file that is not a Vibe Quilting file, a file that cannot be read or is damaged, a file that is too large, a file that needs a newer version of the app than the one you have, a quilt file for a pattern or size this app does not have, and a quilt file with no quilt in it. Nothing changes when it refuses a file. If the file needs a newer version, update the app and try again.',
        'The file only works with this app. Other programs cannot open it, and it is not a picture. Please do not edit it by hand.',
        'Clear all data erases every quilt and version for every size, the list of fabrics you hid, and where you were in the guide. The app then opens as if for the first time. It asks first, and it cannot be undone. Undo will not bring the quilts back.',
        'The Clear all data confirm screen also has Export my data first, to save a file before you erase.',
        'Export data is off while there is nothing saved, and Save quilt file is off while the quilt is empty and has no versions. Clear all data is off when there is nothing to erase.',
      ],
    },
    {
      icon: 'reset',
      title: 'Resets',
      steps: [
        'Reset to shuffle, in the three dots menu, removes every fabric you placed by hand. It asks first, and it is off when no piece is placed by hand.',
        'Reset blocks puts every block back in its place and turn. The fat quarters and hand-placed fabrics stay.',
        'Start fresh, at the top left of the quilt and in the three dots menu, empties the quilt for the size you have open, puts the blocks back, and starts the guide. It can also delete that size\'s saved versions if you tick the box. Resume the guide keeps the quilt instead.',
        'Reset to shuffle, Reset blocks and Start fresh each save an automatic version first, so you can restore the quilt from Versions even after a reload. Start fresh does not when you tick the box to delete versions.',
        'Undo brings back what those three changed, but not deleted versions.',
        'To erase every size at once, use Clear all data in the three dots menu. It saves no version, and Undo cannot bring anything back.',
      ],
    },
    {
      icon: 'keyboard',
      title: 'Keyboard on a computer',
      steps: [
        'Tab moves between buttons and fabrics. Enter or Space picks the one in focus.',
        wide
          ? 'Escape lets go of the fabric you are painting with, the piece you are looking at, and the block you picked up. It also closes an open sheet, the Save & export menu and the build sheet preview, cancels a drag, and ends the Hide a fabric mode.'
          : 'Escape lets go of the fabric you are painting with, the piece you are looking at, and the block you picked up. It also closes an open sheet and the build sheet preview, cancels a drag, and ends the Hide a fabric mode.',
        ...(wide ? ['In the Save & export menu, the up and down arrows, Home and End move between items.'] : []),
        'Ctrl+Z or Cmd+Z undoes. Shift+Ctrl+Z, Shift+Cmd+Z, Ctrl+Y or Cmd+Y redoes. They do not work while you type a version name or while the build sheet preview is open.',
      ],
    },
    {
      icon: 'check',
      title: 'Good to know',
      steps: [
        'Prints are shown at their real size on the quilt.',
        'The exact spot each piece is cut from the print will differ when you sew it.',
        'A phone turned on its side is usually wide enough for the side panel layout.',
        'The ? button, under the fit button at the top right of the quilt, opens this reference. How to use, at the top of the three dots menu, opens it too.',
        wide
          ? 'The three dots menu lists, from the top: How to use, Save a version, Versions, Resume the guide, Start fresh, Reset to shuffle, Reset blocks, then Your data with Export data, Import data and Clear all data.'
          : 'The three dots menu lists, from the top: How to use, Save & export with its four actions, Save a version, Versions, Resume the guide, Start fresh, Reset to shuffle, Reset blocks, then Your data with Export data, Import data and Clear all data.',
        'The first time you use the app, a tip at the bottom of the quilt explains painting. Got it hides it, and More tips opens this reference. It also goes away once you paint a piece.',
      ],
    },
  ];
}

export function Help({
  wide,
  pattern,
  pieceCount,
  letterRange,
}: {
  wide: boolean;
  pattern: PatternDef;
  pieceCount: number;
  letterRange: string;
}) {
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
          {t.figure && (
            <div className="help-figure">
              <FatQuarterDiagram pattern={pattern} />
            </div>
          )}
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
