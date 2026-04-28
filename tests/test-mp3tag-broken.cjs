const MP3Tag = require('mp3tag.js');
const Buffer = require('buffer').Buffer;

const buf = Buffer.alloc(1024);
const tags = new MP3Tag(buf);
tags.read();

tags.tags.title = "Hello World";
tags.save();

const reader = new MP3Tag(tags.buffer);
reader.read();
console.log("Broken title mapping:", reader.tags.title);
