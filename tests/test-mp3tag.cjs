const MP3Tag = require('mp3tag.js');
const Buffer = require('buffer').Buffer;

const buf = Buffer.alloc(1024);
const tags = new MP3Tag(buf);
tags.read(); // Read even if empty
tags.tags.title = "Hello World";
tags.save();
const b = tags.buffer;

const reader = new MP3Tag(b);
reader.read();
console.log(reader.tags.title);
console.log(reader.tags.v2);
