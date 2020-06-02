
// Imports
var fs = require('fs');
var async = require('async');
var path = require('path');
var common = require('./common');
var logger = require('./logger');
var createProjectViewControl = require('./createProjectViewControl');


// Module name
var moduleName = 'Create Project';

// Handle 'Create Web Project' commands
function handleCommand() {

	logger.info(moduleName, '==============================Creat Web Project start!');
	createProjectViewControl.showView().then((pathArray) => {
		generateApp(pathArray[0], pathArray[1]);
	},
	(err) => {
		logger.info(moduleName, err);
	});
	
}
exports.handleCommand = handleCommand;

function generateApp(destPath, tempPath) {

	logger.info(moduleName, 'App generating...');

	// Copy template
	copyDir(tempPath, destPath, function (err) {

		// Copy failed
		if (err) {

			logger.warning(moduleName, 'Generate App failed for filesystem permission!');
			logger.debug(moduleName, err);
			throw err;

		// Copy sucesfully
		} else {
			logger.info(moduleName, 'Folder generated');
			let packageId = common.GetRandomNum(10);
			let packageName = path.basename(destPath);
			logger.info(moduleName, 'The random App ID is: ' + packageId);

			common.writeConfigXml(packageId, packageName, destPath + path.sep + 'config.xml');
			// add the <name> attribute in the config.xml
			//common.writeConfigXmlNameAttr(packageName, destPath + path.sep + 'config.xml');
			logger.info(moduleName, 'The config.xml was updated');

			updateWorkspace(destPath);
			//deferred.resolve(destPath);
		}

		logger.info(moduleName, '==============================Creat Web Project end!');
	});
};

// Open the generated App
function updateWorkspace (destPath) {
	atom.project.addPath(destPath, {mustExist: false, exact: true});
	atom.workspace.open(destPath + path.sep + 'config.xml');
}

// Make dir
function mkdirs(p, mode, f, made) {

	if (typeof mode === 'function' || mode === undefined) {
		f = mode;
		mode = 0777 & (~process.umask());
	}
	if (!made)
		made = null;

	var cb = f || function () { };
	if (typeof mode === 'string')
		mode = parseInt(mode, 8);
	p = path.resolve(p);

	fs.mkdir(p, mode, function (er) {
		if (!er) {
			made = made || p;
			return cb(null, made);
		}
		switch (er.code) {
			case 'ENOENT':
				mkdirs(path.dirname(p), mode, function (er, made) {
					if (er) {
						cb(er, made);
					} else {
						mkdirs(p, mode, cb, made);
					}
				});
				break;

			// In the case of any other error, just see if there's a dir
			// there already.  If so, then hooray!  If not, then something
			// is borked.
			default:
				fs.stat(p, function (er2, stat) {
					// if the stat fails, then that's super weird.
					// let the original error be the failure reason.
					if (er2 || !stat.isDirectory()) {
						cb(er, made);
					} else {
						cb(null, made);
					}
				});
				break;
		}
	});
}

// Count the files that need to be copied
function _ccoutTask(from, to, cbw) {

	async.waterfall([
		function (callback) {
			fs.stat(from, callback);
		},
		function (stats, callback) {
			if (stats.isFile()) {
				cbw.addFile(from, to);
				callback(null, []);
			} else if (stats.isDirectory()) {
				fs.readdir(from, callback);
			}
		},
		function (files, callback) {
			if (files.length) {
				for (var i = 0; i < files.length; i++) {
					_ccoutTask(path.join(from, files[i]), path.join(to, files[i]), cbw.increase());
				}
			}
			callback(null);
		}
	], cbw);
}

// wrap the callback before counting
function ccoutTask(from, to, cb) {
	var files = [];
	var count = 1;

	function wrapper(err) {
		count--;
		if (err || count <= 0) {
			cb(err, files);
		}
	}
	wrapper.increase = function () {
		count++;
		return wrapper;
	};
	wrapper.addFile = function (file, dir) {
		files.push({
			file: file,
			dir: dir
		});
	};

	_ccoutTask(from, to, wrapper);
}

// Copy a single file
function copyFile(file, toDir, cb) {
	async.waterfall([
		function (callback) {
			fs.exists(toDir, function (exists) {
				if (exists) {
					callback(null, false);
				} else {
					callback(null, true);
				}
			});
		}, function (need, callback) {
			if (need) {
				mkdirs(path.dirname(toDir), callback);
			} else {
				callback(null, true);
			}
		}, function (p, callback) {
			var reads = fs.createReadStream(file);
			var writes = fs.createWriteStream(path.join(path.dirname(toDir), path.basename(file)));
			reads.pipe(writes);
			//don't forget close the  when  all the data are read
			reads.on('end', function () {
				writes.end();
				callback(null);
			});
			reads.on('error', function (err) {
				logger.error(moduleName, 'error occur in reads');
				callback(true, err);
			});

		}
	], cb);

}

//copy a directory
function copyDir(from, to, cb) {
    if (!cb) {
		cb = function () { };
	}
	async.waterfall([
		function (callback) {
			fs.exists(from, function (exists) {
				if (exists) {
					callback(null, true);
				} else {
					logger.warning(from + ' not exists');
					callback(true);
				}
			});
		},
		function (exists, callback) {
			fs.stat(from, callback);
		},
		function (stats, callback) {
			if (stats.isFile()) {
				// one file copy
				copyFile(from, to, function (err) {
					if (err) {
						// break the waterfall
						callback(true);
					} else {
						callback(null, []);
					}
				});
			} else if (stats.isDirectory()) {
				ccoutTask(from, to, callback);
			}
		},
		function (files, callback) {
			// prevent reaching to max file open limit
			async.mapLimit(files, 10, function (f, cb) {
				copyFile(f.file, f.dir, cb);
			}, callback);
		}
	], cb);
}
