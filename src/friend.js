var AsyncLock = require('async-lock');
var _ = require('lodash');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
const rmdir = require('rimraf');

const defaultOptions = {
  keyChunkSize: 3,
  keyIndex: '_keys'
};

class Friend {

    constructor(storagePath, options) {
        this.options = Object.assign({},
            defaultOptions, options);
        this.storagePath = path.normalize(storagePath);
        if (this.storagePath.slice(-1) !== path.sep) {
            this.storagePath = `${this.storagePath}${path.sep}`;
        }
        this.lock = new AsyncLock();
        if (this.options.keyIndex) {
          this.keyIndex = [];
          try {
            const result = fs.readFileSync(this._storagePath(this.options.keyIndex), 'utf8');
            if (typeof result === 'object' && typeof result.length === 'number') {
              this.keyIndex = result;
            }
          } catch(err) {
            // pass
          }
        }
    }

    _chunkedPath(key) {
        const kcs = this.options.keyChunkSize;

        let ns = key.split('.');
        const prefix = ns[ns.length - 1].slice(0, kcs);
        ns.pop();
        ns.push(`${prefix}.json`);
        return ns;
    }

    _storagePath(key) {
        let parts = this._chunkedPath(key);
        parts.unshift(this.storagePath);
        return path.join.apply(undefined, parts);
    }

    _mkdirRecursive(path) {
        return new Promise((res, rej) =>
            mkdirp(path, (err) => err ? rej(err) : res()));
    }

    _keystorePath(key) {
        const finalPath = this._storagePath(key);
        return new Promise((res, rej) =>
            this.lock.acquire(finalPath, done =>
                this._mkdirRecursive(path.dirname(finalPath))
                    .then(() => done())
                    .catch(done), err =>
            err ? rej(err) : res(finalPath)));
    }

    _readStore(jsonFile) {
        return new Promise((res, rej) =>
            fs.readFile(jsonFile, (err, data) =>
                err && err.code === 'ENOENT' ?
                    fs.writeFile(jsonFile, '{}', (err, ret) =>
                        err ? rej(err) : res({})) :
                    err ?
                        rej(err) :
                        res(JSON.parse(data))
            ));
    }

    _writeStore(jsonFile, data) {
        return new Promise((res, rej) =>
            fs.writeFile(jsonFile, JSON.stringify(data), (err, ret) =>
                err ? rej(err) : res(true))
        );
    }

    _updateStore(jsonFile, key, value) {
        return new Promise((res, rej) =>
                this._readStore(jsonFile)
                    .then(data =>
                        (typeof key === 'object' ?
                            this._writeStore(jsonFile, Object.assign({}, data, key)) :
                            this._writeStore(jsonFile, Object.assign({}, data, {[key]: value})))
                            .then(res)
                            .catch(rej))
                    .catch(rej)
        );
    }

    set(key, value) {
        return new Promise((res, rej) => {
            this._keystorePath(key)
                .then(jsonFile => this.lock.acquire(jsonFile, done =>
                    this._updateStore(jsonFile, key, value)
                      .then(result => {
                        if (typeof value !== 'undefined' && this.keyIndex.indexOf(key) === -1) {
                          this.keyIndex.push(key);
                          this._syncIndex()
                            .catch(err => rej(err));
                        }
                        done(undefined, result);
                      })
                      .catch(done), (err, ret) =>
                    err ? rej(err) : res(ret)))
                .catch(rej);
        });
    }

    get(key) {
        return new Promise((res, rej) => {
            this._keystorePath(key)
                .then(jsonFile => this.lock.acquire(jsonFile, done =>
                    this._readStore(jsonFile)
                        .then(data => done(undefined, data))
                        .catch(done), (err, data) =>
                    err ? rej(err) : res(data[key])))
                .catch(rej);
        });
    }

    unset(key) {
        this.keyIndex = this.keyIndex.filter(k => k !== key);
        this._syncIndex();
        return this.set(key, undefined);
    }

    clear(key) {
      return new Promise((res, rej) => {
        rmdir(this._storagePath(key), (err, result) => {
          if (err) {
            rej(err);
          } else {
            res(true);
          }
        });
      });
    }

    _syncIndex() {
      return this.set(this.options.keyIndex, this.keyIndex);
    }
}

module.exports = Friend;
