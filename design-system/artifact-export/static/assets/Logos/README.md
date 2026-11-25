The OnTrack mark: a white check in a rounded square of `brand-fill` (#12634f in both themes). Copied from the app's `public/` folder.

- `ontrack-mark.svg`: the mark at 28px, the browser tab icon. Two inks: `brand-fill` and white. It reads on both themes' `bg`, so it needs no dark version.
- `ontrack-app-icon-512.png`: the installed app's icon.
- `ontrack-maskable-512.png`: the Android maskable icon, with the safe zone around the check.

In a page built from the bundle, use `OnTrack.Logo` (the mark alone, `inverse` on a brand cover) or `OnTrack.BrandMark` (the mark with "OnTrack" in Archivo 20px bold). Never recolor or redraw the mark.
