var gulp = require('gulp');
var update = require('./update');

gulp.task('default', function (cb) {
  update(cb);
});
