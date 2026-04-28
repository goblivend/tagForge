# Event Driven Actions

There is a core `useEffect` event tracker bound strictly within `Library.tsx` running asynchronously isolated from any React rendering lag.
- Esc: Triggers the Discard modal organically.
- Ctrl + S: Directly commits the Active AudioTags.
- Navigation (`N`, `P`, `Spacebar`, `Arrows`): Seamlessly increments the internal File List pointer iteratively and streams logic to the internal audio player.
