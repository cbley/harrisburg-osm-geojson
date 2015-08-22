var fs = require('fs');
var request = require('request');
var xml2js = require('xml2js');
var async = require('async');
var unzip = require('unzip');

var lastUpdateFile = './.lastUpdatedAt';
var extractsBaseUrl = 'https://s3.amazonaws.com/metro-extracts.mapzen.com';
var hbgArchive = 'harrisburg_pennsylvania.imposm-geojson.zip';
var tempFile = './temp.zip';

module.exports = update;

function update (callback) {
  async.parallel(
    [getLastUpdatedAtRemote, getLastUpdatedAtLocal],
    function (err, results) {
      if (err) throw err;

      var remoteDate = new Date(results[0]);
      var localDate = new Date(results[1]);

      if (remoteDate > localDate) {
        console.log("Updating data from Mapzen's metro extracts");
        updateFromRemote(function (err) {
          if (err) throw err;

          createLastUpdatedAtFile(remoteDate, callback);
        });
      } else {
        console.log('Date is up-to-date.');
        callback();
      }
    }
  );
}

function updateFromRemote (callback) {
  var hbgGeoJsonZipUrl = extractsBaseUrl + '/' + hbgArchive;

  request(hbgGeoJsonZipUrl)
    .pipe(fs.createWriteStream(tempFile))
    .on('error', function (e) {
      callback(e);
    })
    .on('close', function () {
      fs.createReadStream(tempFile)
        .pipe(unzip.Extract({
          path: './data/'
        }))
        .on('close', function () {
          fs.unlinkSync(tempFile);
          callback();
        });
    });
}

function getLastUpdatedAtLocal (callback) {
  fs.readFile(lastUpdateFile, 'utf-8', function (err, lastModified) {
    if (err && err.code === 'ENOENT') {
      createDefaultFile(function (err) {
        if (err) callback(err);

        getLastUpdatedAtLocal(callback);
      });
    } else {
      callback(err, lastModified);
    }
  });
}

function createDefaultFile (callback) {
  console.log('Creating default lastUpdatedAt file');
  createLastUpdatedAtFile(new Date(1983, 11, 26), callback);
}

function createLastUpdatedAtFile (date, callback) {
  fs.writeFile(lastUpdateFile, date.toISOString(), callback);
}

function getLastUpdatedAtRemote (callback) {
  request(extractsBaseUrl, function (err, response, body) {
    if (err) callback(err);

    xml2js.parseString(body, function (err, result) {
      if (err) callback(err);

      var contents = result.ListBucketResult.Contents;
      var match = contents.filter(matchesKey)[0];
      var lastModified = String(match.LastModified);

      callback(null, lastModified);
    });
  });
}

function matchesKey (item) {
  var key = 'LastUpdatedAt';
  return String(item.Key) === key;
}
