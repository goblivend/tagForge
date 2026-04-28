const MP3Tag = require('mp3tag.js');
const Buffer = require('buffer').Buffer;

const buf = Buffer.alloc(1024);
const tags = new MP3Tag(buf);
tags.read();

// Initialize v2 object if not exists
if (!tags.tags.v2) tags.tags.v2 = {};
tags.tags.v2.TIT2 = "Hello World";
tags.save();

const reader = new MP3Tag(tags.buffer);
reader.read();
console.log(reader.tags.title);
console.log(reader.tags.v2.TIT2);
