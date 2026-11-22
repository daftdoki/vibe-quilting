import type { PatternDef } from '../core/types';
import { FatQuarterDiagram } from './FatQuarterDiagram';
import { Icon, type IconName } from './Icon';
import { tapText } from './pointerWords';
import { TITLES } from './guide/titles';
import { COUNTED_STEPS } from './guide/useGuide';

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
        'The guide takes an empty quilt to a finished design one step at a time. It starts on its own the first time you open a size, and again when you tap Start fresh.',
        `It opens with an overview called ${TITLES.intro}. It lists each step with one line on what happens there, then an After the steps section, then a Where to get help box. Tap Start to go to Quilt size, or How to use to open this guide. The overview does not show when you resume the guide or tap Finish setup.`,
        'After the steps says that once the steps are done you can keep changing anything on the main screen, and that you can skip the guide and work on the quilt by hand. Its Skip the guide button does the same as Exit guide.',
        wide
          ? `The guide card sits at the top of the side panel. After the overview it has ${COUNTED_STEPS.length} steps and a closing step. The counter at its top says which step you are on, and reads Before you start on the overview.`
          : `The guide card sits under the quilt, above the fabrics. After the overview it has ${COUNTED_STEPS.length} steps and a closing step. The counter at its top says which step you are on, and reads Before you start on the overview.`,
        wide
          ? 'While the guide is open, the Fabrics and Blocks switch at the top is hidden, and the fat quarter stack shows only in Turn and move blocks. Each step shows the controls it needs.'
          : 'While the guide is open, the Fabrics and Blocks switch and the Fat quarters button are hidden. Each step shows the controls it needs.',
        'Quilt size: pick a quilt size. If that size already has a design, you can tap Start this size empty, or Keep it and exit the guide.',
        'Pick your fabrics: tap fabrics to fill the stack of fat quarters in order. Dragging is off in this step. Tap any slot to make it the next one to fill, or to replace or clear it. Pick at random replaces every fat quarter with a random mix of fabrics each time you tap it, so tap it again to see another mix. Fill the rest for me keeps the fat quarters you picked and fills only the empty ones. It shows only while some are empty. Rearrange keeps the fabrics you have and only changes where each one lands. It shows once at least 2 fat quarters have a fabric. Clear picks, beside it, empties every fat quarter so you can pick again. It shows once you have picked at least one. Undo brings them back.',
        'At the top, the step says you can pick each fabric yourself, let the app pick at random, or do some of each.',
        'How it works, beside the step\'s title, opens a short list under the title: how a fat quarter is cut, what each button in the step does, and whether fabrics will repeat in this size. It also has See how a fat quarter is used, which opens a picture. Tap How it works again to close it. It starts closed each time you come to the step.',
        'Exclude a fabric, in the same step, is for fabrics you do not want. Tap it and the card changes to Exclude fabrics, with one instruction, a count of excluded fabrics and a Done button. The rest of the step, and Back and Next, are put away until you finish.',
        'While you are excluding, the fabric list has a yellow dashed frame and shows every fabric. A fabric that shows has an eye mark. An excluded one is grey with a slash through it. Tap a fabric to exclude it, and tap an excluded one to bring it back. A note at the top of the quilt names the fabric each time.',
        'Tap Done when you are finished. Escape and Exit guide end it too.',
        'An excluded fabric is not in the fabric list or the fat quarter stack\'s fabric picker, so it cannot be picked, painted or dragged. When any are excluded, the step says how many, with Show them to see them again and bring them back.',
        'Excluding a fabric takes it off the quilt you have open. The fat quarters that held it become empty, and pieces you placed by hand with it go back to the shuffle. Quilts in other sizes keep it, but the list applies to every size, so Pick at random and Fill the rest for me never choose it in any size. Undo brings the quilt back, but the fabric stays excluded. You cannot exclude the last fabric.',
        'In this step, yellow outlines on the quilt show every piece the current fat quarter fills, except pieces you placed by hand.',
        'If you tap Next while some fat quarters are still empty, the guide asks first. Fill the rest and go on fills them and moves on. Keep picking stays on the step.',
        'Turn and move blocks: this is where you balance the quilt, and the step says so at the top. Turning every other block stops the same shapes lining up from block to block. Move a block when two alike fabrics sit side by side, or one area looks too dark or too busy, until the colours look evenly spread.',
        'In that step, pick Turn every other block or All the same way up, then tap blocks to swap or turn them.',
        'Touch-ups: this step is optional, and it says so at the top. It is for changing a single piece, for example where two alike fabrics touch or one piece stands out too much. The quilt zooms to one block at a time so you can paint pieces. Use Previous block and Next block, or Skip touch-ups. On the last block, Next block becomes Finish. These buttons are in one row under the step counter, with Back.',
        'Your quilt is ready: export a picture, save a quilt file, print a build sheet, or tap Keep editing to close the guide. A list shows where things are once the guide is closed.',
        'If the quilt has no name yet, that screen has a name field with a Save name button above those buttons. If it has a name, the name shows there instead. See Name your quilt.',
        'Back and Next are near the top of the guide card, under the step counter. Back is white with an arrow pointing left, and Next is yellow with an arrow pointing right. Back goes to the previous step and keeps your changes. On Quilt size, Back goes to the overview. The overview has no Back. Start and How to use sit there instead. Next is not shown on Touch-ups or on the last screen, which have their own buttons. Exit guide, at the top right of the card, closes it at any step and leaves the quilt as it is.',
        'The guide remembers its step for each size, so a reload or a size switch picks up where you were.',
        'If any fat quarters are still empty after you leave the guide, a Finish setup button shows at the top left of the quilt. Tap it to go back to the Pick your fabrics step.',
        'To open the guide again on the quilt you have, open the three dots menu and tap Resume the guide. It keeps the quilt as it is and opens at Pick your fabrics if any fat quarters are empty, otherwise at Turn and move blocks. It is not in the menu while the guide is open.',
        'To set up a size again from scratch, tap Start fresh at the top left of the quilt. It is also in the three dots menu. It empties the quilt for the size you have open and starts the guide from the overview. Other sizes are not touched.',
        'Start fresh is always there, on the quilt and in the three dots menu. On an empty quilt with no name and no excluded fabrics it goes straight back to the overview without asking, which is the quick way to pick a different size.',
        'When the quilt has fabric on it, has a name, or a fabric is excluded, Start fresh asks first. Saved versions for the size are kept, and the quilt you had is saved as an automatic version. Undo brings the quilt back too. To delete versions, use Delete in the Versions list.',
        'Start fresh also clears the quilt\'s name, because a fresh start is a new quilt. The confirm screen says so. Undo does not bring the name back.',
        'If you excluded any fabrics, Start fresh brings them back, so every fabric can be picked again, and the confirm screen says so. The excluded list is one list for every size, so they come back in every size, and Undo does not exclude them again. To start over and keep a fabric out, exclude it again in Pick your fabrics.',
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
        'A fabric you excluded does not show in the list, so it cannot be painted or dragged.',
        wide
          ? 'To exclude a fabric or bring one back, use Exclude a fabric in the guide\'s Pick your fabrics step. There every fabric shows. One that shows has an eye mark, and an excluded one is grey with a slash, with Excluded under its name. Excluding also takes the fabric off the quilt you have open, and the list applies to every size. To get there, open the three dots menu, tap Resume the guide, and tap Back if it opens at Turn and move blocks.'
          : 'To exclude a fabric or bring one back, use Exclude a fabric in the guide\'s Pick your fabrics step. There every fabric shows. One that shows has an eye mark, and an excluded one is grey with a slash. Excluding also takes the fabric off the quilt you have open, and the list applies to every size. To get there, open the three dots menu, tap Resume the guide, and tap Back if it opens at Turn and move blocks.',
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
        `The picture shows one fat quarter cut into its ${pieceCount} pieces, and where those pieces end up after the shuffle. In the guide's Pick your fabrics step, tap How it works beside the title, then See how a fat quarter is used, to open the same picture with a few lines about it.`,
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
        'When the stack has more fat quarters than there are fabrics you have not excluded, some fabrics repeat. In the guide\'s Pick your fabrics step, How it works says so.',
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
        'Tap the size at the top left, under the quilt\'s name, to pick a size.',
        'Each size shows its name, its grid of blocks, and its finished size in inches. The current one has a check mark.',
        'Each size keeps its own design, so you can switch back without losing anything.',
        'Each size also has its own name, so after a switch the top shows that size\'s name.',
      ],
    },
    {
      icon: 'pencil',
      title: 'Name your quilt',
      steps: [
        wide
          ? 'The quilt\'s name goes in the field at the top left of the screen, above the size. When it is empty it says Type a name for your quilt in grey and has a dashed edge. The pencil at its right edge shows you can change it. Beside the size, in grey, is the pattern and fabric collection.'
          : 'The quilt\'s name goes in the field at the top left of the screen, above the size. When it is empty it says Type a name for your quilt in grey and has a dashed edge. The pencil at its right edge shows you can change it.',
        'Tap the field and type. Enter, Done on the keyboard, or tapping somewhere else saves it. Escape puts back the name it had. A name can be up to 60 characters. Empty the field to remove the name.',
        'The name is used for the files you save. Export PNG names the picture after it, such as Ginger\'s Quilt.png. Save quilt file names the file after it, then the date. Print build sheet puts it at the top of page 1. The browser tab shows it too. Export data keeps its own name, because it holds every quilt.',
        'Characters that a file name cannot hold, such as / ? : * " < > | and \\, are left out of file names. The name itself keeps them.',
        'If the quilt has no name when you tap Export PNG, Save quilt file or Print build sheet, the app asks for one first. Save name and continue saves the name and carries on. Not now carries on with the usual file name, and the app does not ask again for that quilt until you reload the page or tap Start fresh. The close button or Escape cancels, and nothing is saved or printed.',
        'Each size has its own name. Switching size shows that size\'s name, or the empty field.',
        'Start fresh clears the name, and its confirm screen says so. Undo does not bring it back. Undo and redo never change the name.',
        'The name travels in quilt files and full exports. Opening a quilt file that has a name gives the quilt that name. A file without one keeps the name you have here. Importing a full export replaces every name with the ones in the file.',
        'Saved versions keep their own names. Naming the quilt does not change them.',
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
        'Undo covers changes to the quilt: fabrics on pieces, the fat quarter stack, and blocks. It does not undo saving, renaming or deleting a version, naming the quilt, a size switch, or excluding a fabric. After excluding a fabric, Undo brings back the quilt, but the fabric stays excluded.',
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
        'Automatic versions have an Automatic tag and are named for the action, such as Before shuffle. The app saves one before Shuffle, Rearrange, Reset to shuffle in the three dots menu, Reset blocks, Turn every other block, All the same way up, Pick at random, Fill the rest for me, Fill the rest and go on, Clear picks, excluding a fabric the quilt uses, Start fresh, Start this size empty, restoring a version, and opening a quilt file.',
        'Reset to shuffle for a single piece, in the bar at the bottom of the quilt, does not save one. Undo brings that piece back.',
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
        'The picture is named after the quilt, such as Ginger\'s Quilt.png. A quilt with no name gives a file named after the project and the size.',
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
        'Page 1 has the quilt\'s name as its heading, with the project and size under it. A quilt with no name has the project as its heading. Then come the size, the finished size, the grid of blocks, how many fat quarters to buy, and the date. It lists the fabrics by number with name, SKU and how many fat quarters to buy, with a box to tick when you have each one. Then comes the stacking order: the order to pile the fat quarters before you cut, with number 1 on top.',
        'Then there is one card per block, in block number order. Each card draws the block the same way up, with the fabric number in each piece and the piece letter in its top left corner. A number you placed by hand is underlined, and the card says which pieces changed. An empty piece shows a dash. Each card has a Sewn box to tick.',
        'Large cards fit 4 to a page. Compact cards fit 9 to a page and use less paper. Pick one at the top of the preview.',
        'On its own page after the cards, a map shows where each block goes, with Row 1 at the top. Each block has its number in the middle. Only its first piece is drawn, with its letter, to show which way up to turn the block. If you placed pieces by hand, a table lists them.',
        'If you placed one fabric on more pieces of one letter than its fat quarters give, the sheet says how many more fat quarters of it to buy. A fat quarter gives one piece of each letter.',
        'To keep a copy, pick Save as PDF in your printer choices. When the quilt has a name, most browsers offer it as the PDF\'s file name. The preview stays open after a reload until you close it.',
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
        'Save quilt file makes one file with the quilt for the size you have open, all its saved versions, where you were in the guide, and its name. It is named after the quilt, then the date, such as Ginger\'s Quilt 2026-11-21. A quilt with no name gives vibe-quilting, the size, then the date. It is off while the quilt is empty and the size has no versions.',
        'Open the three dots menu. Your data is at the bottom, with Export data, Import data and Clear all data.',
        'Export data saves one file with everything: the quilt for every size, all your saved versions, the names of your quilts, where you were in the guide, and the fabrics you excluded. It is named vibe-quilting, then the date.',
        'On a phone or tablet, Save quilt file and Export data open the share sheet where it can, so you can save the file to Files, AirDrop it, or send it to yourself. Otherwise the file downloads. Keep it somewhere safe as a backup.',
        'To move to another device, save a file on the first one. Send the file to yourself, or save it where both devices can reach it. On the other device, open the three dots menu, tap Import data and pick the file. Import data opens either kind of file.',
        'Opening a quilt file replaces only that one size. The quilt you had in that size is kept as an automatic version called Before opening a file. It is not kept if that size was empty, already held the same quilt, or matches its newest version. The versions in the file are added to yours, without copies. The other sizes are not touched, and the fabrics you excluded stay excluded. If the file has a name for the quilt, the quilt takes that name, and the confirm screen says so. A file without one keeps the name you have here. The app then reloads on that size. You can undo it by restoring that automatic version from Versions.',
        'A full export is different. Import data replaces everything on the device you run it on. The quilts, versions and quilt names there are erased, and it cannot be undone. The app shows what the file holds and what will be erased before it does anything.',
        'For a full export, you can tap Export my data first on the confirm screen to keep what is on that device. It saves a file of the current data, and the confirm screen stays open.',
        'After a full import the app reloads and opens the size that was open when the file was exported.',
        'Files exported by older versions of the app keep working. A file from a newer version imports everything this version understands, and the confirm screen says how many quilts and versions it will skip.',
        'If a fabric in the file is not in this app, the confirm screen says so, and the spots that used it open with no fabric. You can paint them again. If a quilt\'s blocks no longer fit, they go back to their starting places, and the confirm screen says that too.',
        'Import refuses a file that is not a Vibe Quilting file, a file that cannot be read or is damaged, a file that is too large, a file that needs a newer version of the app than the one you have, a quilt file for a pattern or size this app does not have, and a quilt file with no quilt in it. Nothing changes when it refuses a file. If the file needs a newer version, update the app and try again.',
        'The file only works with this app. Other programs cannot open it, and it is not a picture. Please do not edit it by hand.',
        'Clear all data erases every quilt, version and quilt name for every size, the list of fabrics you excluded, and where you were in the guide. The app then opens as if for the first time. It asks first, and it cannot be undone. Undo will not bring the quilts back.',
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
        'Start fresh, at the top left of the quilt and in the three dots menu, empties the quilt for the size you have open, puts the blocks back, and starts the guide from the overview. It keeps that size\'s saved versions, brings back any fabrics you excluded, and clears the quilt\'s name. Resume the guide keeps the quilt instead.',
        'Reset to shuffle, Reset blocks and Start fresh each save an automatic version first, so you can restore the quilt from Versions even after a reload.',
        'Undo brings back what those three changed. It does not bring back a name that Start fresh cleared.',
        'To erase every size at once, use Clear all data in the three dots menu. It saves no version, and Undo cannot bring anything back.',
      ],
    },
    {
      icon: 'keyboard',
      title: 'Keyboard on a computer',
      steps: [
        'Tab moves between buttons and fabrics. Enter or Space picks the one in focus.',
        wide
          ? 'Escape lets go of the fabric you are painting with, the piece you are looking at, and the block you picked up. It also closes an open sheet, the Save & export menu and the build sheet preview, cancels a drag, and ends the Exclude a fabric mode. In the quilt name field it puts back the name the field had.'
          : 'Escape lets go of the fabric you are painting with, the piece you are looking at, and the block you picked up. It also closes an open sheet and the build sheet preview, cancels a drag, and ends the Exclude a fabric mode. In the quilt name field it puts back the name the field had.',
        ...(wide ? ['In the Save & export menu, the up and down arrows, Home and End move between items.'] : []),
        'Ctrl+Z or Cmd+Z undoes. Shift+Ctrl+Z, Shift+Cmd+Z, Ctrl+Y or Cmd+Y redoes. They do not work while you type a quilt name or a version name, or while the build sheet preview is open.',
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
              <li key={s}>{tapText(s)}</li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
