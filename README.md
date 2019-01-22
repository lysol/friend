![HAAANK]
(http://i.imgur.com/WKi7jOB.jpg)

# F*R*I*E*N*D

This is a persistent storage module that I made for an IRC bot that had to deal with a few hundred thousand records for various things I was storing. This is meant to have a simple interface, should be thread safe since it uses a file based lock, and should scale semi-linearly depending on the number of records, their composition, and how you configure the key chunking. There is no journal or other kind of incomplete write protection so you'll have to provide your own mechanism for that (handle SIGINT and finish writes before exiting, for example).

## Quickstart

Read the code for now, everything returns a promise

## TODO
* Write documentation
* Import tests from another project I wrote this within
