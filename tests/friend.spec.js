const Friend = require('../src/friend');
const chai = require('chai');
const expect = chai.expect;
chai.config.includeStack = true;
const fs = require('fs');
const rmdir = require('rimraf');
const async = require('async');

describe('Friend', () => {

    describe('init friend', () => {
        let friend;
        beforeEach(done =>
            fs.mkdir('/tmp/testfriend/', (err, res) => {
                friend = new Friend('/tmp/testfriend', {keyChunkSize: 5, keyIndex: '_index'});
                done();
            })
        );

        // need to inspect the store dir once in a wihle
        afterEach.ignore = () => {};

        afterEach(done => {
            rmdir('/tmp/testfriend', () =>
                rmdir('/tmp/mkdirtest', done));
        });

        it('should init', () => {
            expect(friend.options).to.be.a('object');
            expect(friend.options.keyChunkSize).to.equal(5);
        });

        it('should create the correct path', () => {
            const testKey = 'short';
            let cunked = friend._chunkedPath(testKey);
            let stopath = friend._storagePath(testKey);
            expect(cunked).to.have.lengthOf(1);
            expect(stopath).to.equal('/tmp/testfriend/short.json');

            const testKey2 = 'longer.key';
            expect(friend._chunkedPath(testKey2)).to.have.lengthOf(2);
            expect(friend._storagePath(testKey2)).to.equal('/tmp/testfriend/longer/key.json');

            const testKey3 = 'more.namespaced.longernamedkey';
            expect(friend._chunkedPath(testKey3)).to.have.lengthOf(3);
            expect(friend._storagePath(testKey3)).to.equal('/tmp/testfriend/more/namespaced/longe.json');
        });

        it('should make intermediate directories', done => {

            const testMap = {
                'bot.main': '/tmp/testfriend/bot/main.json',
                'bot.mainMenu': '/tmp/testfriend/bot/mainM.json',
                'bot.mainMenu2': '/tmp/testfriend/bot/mainM.json',
                'some.namespaced.storage.nintendoFamicom': '/tmp/testfriend/some/namespaced/storage/ninte.json',
                'some.namespaced.storage.nintendoSuperFamicom': '/tmp/testfriend/some/namespaced/storage/ninte.json',
                'some.namespaced.secondStorage.segaGenesis': '/tmp/testfriend/some/namespaced/secondStorage/segaG.json',
                'some.namespaced.secondStorage.segaSaturn': '/tmp/testfriend/some/namespaced/secondStorage/segaS.json'
            };

            Promise.all(Object.keys(testMap).map(testKey =>
                new Promise((res, rej) => {
                    let targetPath = testMap[testKey];
                    friend._keystorePath(testKey)
                        .then(path => {
                            expect(path).to.equal(targetPath);
                            const containingDir = path.split('/').slice(0, -1).join('/');
                            const targetContainingDir = targetPath.split('/').slice(0, -1).join('/');
                            expect(containingDir).to.equal(targetContainingDir);
                            expect(fs.existsSync(containingDir)).to.equal(true);
                            res();
                        })
                        .catch(rej);
                })))
                .then(() => done())
                .catch(done);
        });

        it('should read data from a json store', done => {
            const storeFile = '/tmp/testfriend/stora.json';
            fs.writeFileSync(storeFile, '{"storage": 99}');
            friend._readStore(storeFile)
                .then(data => {
                    expect(data).to.have.property('storage');
                    expect(data.storage).to.equal(99);
                    done();
                })
                .catch(done);
        });

        it('should save data to a json store', done => {
            const storeFile = '/tmp/testfriend/stora.json';
            const data = {storage: 666};
            const serialized = JSON.stringify(data);
            friend._writeStore(storeFile, data)
                .then(result => {
                    expect(result).to.equal(true);
                    const contents = fs.readFileSync(storeFile, 'utf8');
                    expect(contents).to.equal(serialized);
                    done();
                })
                .catch(done);
        });

        it('should update data in a json store', done => {
            const storeFile = '/tmp/testfriend/stora.json';
            const testData = [{
                source: {storage: 666},
                key: 'storage',
                value: 667,
                result: '{"storage":667}'
            }, {
                source: {storage: 666},
                key: 'storage',
                value: {nested: 2},
                result: '{"storage":{"nested":2}}'
            }, {
                source: {storage: 666},
                key: {storage: 667, storage2: {more: 5}},
                result: '{"storage":667,"storage2":{"more":5}}'
            }];

            let runners = testData.map(datum => cb => friend._writeStore(storeFile, datum.source)
                    .then(result => {
                        friend._updateStore(storeFile, datum.key, datum.value)
                            .then(result2 => {
                                expect(result2).to.equal(true);
                                const contents = fs.readFileSync(storeFile, 'utf8');
                                expect(contents).to.equal(datum.result);
                                cb();
                            })
                            .catch(err => {
                                cb(err);
                            });
                    })
                    .catch(cb)
            );

            async.series(runners, (err, results) => done(err));
        });

        it('should set a value using a key using the main setter', done => {
            const storeFile = '/tmp/testfriend/stora.json';
            const testData = [{
                storeFile: '/tmp/testfriend/stora.json',
                key: 'storage',
                value: 9999,
                result: '{"storage":9999}'
            }, {
                storeFile: '/tmp/testfriend/nintendo/syste.json',
                key: 'nintendo.systems',
                value: ['famicom', 'super famicom'],
                result: '{"nintendo.systems":["famicom","super famicom"]}'
            }, {
                storeFile: '/tmp/testfriend/nintendo/syste.json',
                key: 'nintendo.systems',
                value: ['famicom'],
                result: '{"nintendo.systems":["famicom"]}'
            }, {
                storeFile: '/tmp/testfriend/stora.json',
                key: 'storage2',
                value: 6666,
                result: '{"storage":9999,"storage2":6666}'
            }, {
                storeFile: '/tmp/testfriend/stora.json',
                key: 'storage',
                value: {'friend': true},
                result: '{"storage":{"friend":true},"storage2":6666}'
            }];

            let runners = testData.map(datum => cb => friend.set(datum.key, datum.value)
                    .then(result => {
                        expect(result).to.equal(true);
                        const contents = fs.readFileSync(datum.storeFile, 'utf8');
                        expect(contents).to.equal(datum.result);
                        cb();
                    })
                    .catch(cb)
            );

            async.series(runners, (err, results) => done(err));
        });

        it('should set and then get a value', done => {
            const testData = [{
                key: 'storage',
                value: 9999
            }, {
                key: 'nintendo.systems',
                value: ['famicom', 'super famicom']
            }, {
                key: 'nintendo.systems',
                value: ['famicom']
            }, {
                key: 'storage2',
                value: 6666
            }, {
                key: 'storage',
                value: {'friend': true}
            }, {
                key: 'storage2',
                value: undefined
            }];

            let runners = testData.map(datum => cb => friend.set(datum.key, datum.value)
                .then(result => {
                    expect(result).to.equal(true);
                    friend.get(datum.key)
                        .then(val => {
                            if (typeof val === 'object') {
                                expect(JSON.stringify(val)).to.equal(JSON.stringify(datum.value));
                            } else {
                                expect(val).to.equal(datum.value);
                            }
                            cb();
                        })
                        .catch(cb);
                })
                .catch(cb));
            async.series(runners, (err, results) => done(err));
        });

        it('should be able to delete a key', done => {
            const key = 'destroyme', value = 'a long string';
            friend.set(key, value)
                .then(result => {
                    expect(result).to.equal(true);
                    friend.get(key)
                        .then(result2 => {
                            expect(result2).to.equal(value);
                            friend.unset(key)
                                .then(() =>
                                    friend.get(key)
                                        .then(finalResult => {
                                            expect(finalResult).be.an('undefined');
                                            done();
                                        })
                                        .catch(done))
                                .catch(done);
                        })
                        .catch(done);
                })
                .catch(done);
        });

        it('should create an index, deleting keys where necessary', done => {
            const storeFile = '/tmp/testfriend/stora.json';
            const testData = [{
                storeFile: '/tmp/testfriend/stora.json',
                key: 'storage',
                value: 9999,
                result: '{"storage":9999}'
            }, {
                storeFile: '/tmp/testfriend/nintendo/syste.json',
                key: 'nintendo.systems',
                value: ['famicom', 'super famicom'],
                result: '{"nintendo.systems":["famicom","super famicom"]}'
            }, {
                storeFile: '/tmp/testfriend/nintendo/syste.json',
                key: 'nintendo.systems',
                value: ['famicom'],
                result: '{"nintendo.systems":["famicom"]}'
            }, {
                storeFile: '/tmp/testfriend/stora.json',
                key: 'storage2',
                value: 6666,
                result: '{"storage":9999,"storage2":6666}'
            }, {
                storeFile: '/tmp/testfriend/stora.json',
                key: 'storage',
                value: {'friend': true},
                result: '{"storage":{"friend":true},"storage2":6666}'
            }];

            let runners = testData.map(datum => cb => friend.set(datum.key, datum.value)
                    .then(result => {
                        expect(result).to.equal(true);
                        const contents = fs.readFileSync(datum.storeFile, 'utf8');
                        expect(contents).to.equal(datum.result);
                        expect(friend.keyIndex).to.contain(datum.key);
                        return friend._syncIndex();
                    })
                    .then(result => {
                        const indexContents = JSON.parse(fs.readFileSync('/tmp/testfriend/_inde.json', 'utf8'));
                        expect(indexContents._index).to.contain(datum.key);
                        cb();
                    })
                    .catch(cb)
            );

          async.series(runners, (err, results) => {
            // delete a key here just to test
            friend.unset('storage2')
              .then(result => {
                expect(friend.keyIndex).to.not.contain('storage2');
                done(err);
              })
              .catch(err => {
                console.error(err);
                expect(false);
                done(err);
              });
          });
        });

        it('should return a list of all keys', done => {
          friend.set('test', 'yes')
            .then(result => friend.set('test2', 'no'))
            .then(result => {
              const res = friend.keys();
              expect(res.length).to.equal(2);
              expect(res[0]).to.equal('test');
              expect(res[1]).to.equal('test2');
              const res2 = friend.keys('2');
              expect(res2.length).to.equal(1);
              expect(res2[0]).to.equal('test2');
              done();
            })
            .catch(done);
        });
    });
});

