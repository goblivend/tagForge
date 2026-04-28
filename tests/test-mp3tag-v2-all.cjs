const MP3Tag = require('mp3tag.js');
const Buffer = require('buffer').Buffer;

const buf = Buffer.alloc(1024);
const tags = new MP3Tag(buf);
tags.read();

tags.tags.v2 = {
  TIT2: "My Title",
  TPE1: "My Artist",
  TALB: "My Album",
  TYER: "2026",
  TCON: "Metal"
};
tags.save();

const reader = new MP3Tag(tags.buffer);
reader.read();
console.log({
  title: reader.tags.title,
  artist: reader.tags.artist,
  album: reader.tags.album,
  year: reader.tags.year,
  genre: reader.tags.genre
});
