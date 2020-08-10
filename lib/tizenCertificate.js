var tizenCertificate = (function(){
	// Imports
	var fs = require('fs');
	var path = require('path');
	var common = require('./common');
	var logger = require('./logger');
	var p12ToPem = require('./p12ToPem');
	var parseString = require('xml2js').parseString;
	const { dialog } = require('electron').remote;
	var generateCertificate = require('./generateCertificate');
	var tizenCertificateViewControl = require('./tizenCertificateViewControl');
	var TizenCM = require('@tizentv/webide-common-tizentv').TizenCM;
	var ProfileManager = require('@tizentv/webide-common-tizentv').ProfileManager;
	var request = require('request');
	var compressing = require('compressing');

	const certPath = common.extensionCertPath;
	const distributorSignerPassword = 'tizenpkcs12passfordsigner';
	const certZipFile = certPath + path.sep + 'certificate-generator.zip';

	// Module name
	var moduleName = 'Tizen Certificate';

	var activeFlag = false ; // To distinguish whether set the new profile as active

	var registerProfile = function(profileName, authorCA, authorCertPath, authorPassword, distributorCA, distributorCertPath, distributorPassword){
		logger.info(moduleName, 'Register certificate to profile: ' + common.profilePath);
		if (!fs.existsSync(authorCA) || !fs.existsSync(authorCertPath) || !fs.existsSync(distributorCA) || !fs.existsSync(distributorCertPath)) {
			logger.error(moduleName, 'certificate path error, there is no cert file!');
			common.showMsgOnWindow(common.ENUM_WINMSG_LEVEL.WARNING, 'Creating new profile failed! ');
			throw (new Error('Creating new profile failed! please check your cert file is downloaded.'));
		}

		var encryptedAuthorPassword = p12ToPem.encryptPassword(authorPassword);
		var encryptedDistributorPassword = p12ToPem.encryptPassword(distributorPassword);

		var profilePrefix = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n'+
			'<profiles active=\"'+ profileName + '\" version="3.1">\n';

		var profileItem = '<profile name=\"'+ profileName + '\">\n' +
			'<profileitem ca=\"'+ authorCA +'\" distributor="0" key=\"' + authorCertPath + '\" password=\"' + encryptedAuthorPassword + '\" rootca=""/>\n' +
			'<profileitem ca=\"'+ distributorCA +'\" distributor="1" key=\"' + distributorCertPath + '\" password=\"' + encryptedDistributorPassword + '\" rootca=""/>\n' +
			'<profileitem ca="" distributor="2" key="" password="xmEcrXPl1ss=" rootca=""/>\n' +
			'</profile>\n';

		if(fs.existsSync(common.profilePath)){
			var originContent = fs.readFileSync(common.profilePath);
			originContent = originContent.toString();
			var newContent = '';
			var strPrefix = '';
			var strVersion = '';
			var strEndProfiles = '';
			/*if(activeFlag){
				var strBeginActive = originContent.indexOf('<profiles active=');
				strPrefix = originContent.substring(0,strBeginActive+17) + '\"' + profileName + '\"';
				strVersion= originContent.indexOf('version=\"3.1\"');
				strEndProfiles= originContent.indexOf('</profiles>');
				var strContent = originContent.substring(strVersion-1,strEndProfiles );
				newContent = strPrefix + strContent + profileItem+'</profiles>';

			}else{*/
				strEndProfiles= originContent.indexOf('</profiles>');
				var strContent = originContent.substring(0,strEndProfiles );
				newContent = strContent +profileItem+ '</profiles>';
			//}

			fs.writeFileSync(common.profilePath, newContent);
		}else{
			profileItem = profilePrefix + profileItem + '</profiles>';
			fs.writeFileSync(common.profilePath, profileItem);
		}

		common.showMsgOnWindow(common.ENUM_WINMSG_LEVEL.INFO, 'Creating new profile successful');

	};

	var checkProfileName =function(name) {
		var nameFlag = true;
		var profileNames = getProfileItems().nameArray;
		if(profileNames && profileNames.length>0){
			for(var i = 0;i< profileNames.length;i++){
				if(name == profileNames[i]){
					nameFlag = false;
					break;
				}
			}
		}
		return nameFlag ;
	};

	var checkCertificateName =function(name){
		var flag = true;
		var certName = common.AuthorPath + '/'+ name+'.p12';
		if(fs.existsSync(certName)){
			flag = false;
		}
		return flag ;
	};

	var getProfileItems =function(){
		var itemNum = 0;
		var nameArray = new Array();
		if(fs.existsSync(common.profilePath)){
			var data = fs.readFileSync(common.profilePath,'utf-8');
			//parse profiles.xml file to get author and distributor p12 certificate file
			parseString(data,{ explicitArray : false}, function(err,result){
				var jsonData = JSON.stringify(result);
				var jsonArray = JSON.parse(jsonData);

				var profiles = jsonArray.profiles.profile;
				var name = '';
				if(profiles && (!profiles.length)){ //For only one profile case
					itemNum = 1;
					name = profiles.$.name;
					nameArray.push(name);
				}else if(profiles && profiles.length){ //For multiple profile case
					itemNum = profiles.length;
					for(var i = 0; i<profiles.length;i++){
						name = profiles[i].$.name;
						nameArray.push(name);
					}
				}

			});
		}

		return {itemNum, nameArray};
	};

	var setActiveProfileItem =function(name){
		if(fs.existsSync(common.profilePath)){
			var profileContent = fs.readFileSync(common.profilePath);
			profileContent = profileContent.toString();
			var strBeginActive = profileContent.indexOf('<profiles active=');
			strPrefix = profileContent.substring(0,strBeginActive+17) + '\"' + name + '\"';
			strVersion= profileContent.indexOf('version=\"3.1\"');
			var strContent = profileContent.substring(strVersion-1 , profileContent.length );
			var newContent = strPrefix + strContent;
			fs.writeFileSync(common.profilePath, newContent);
		}else{
			var waringMsg = 'The ' + common.profilePath + ' is not exist' ;
			logger.warning(moduleName, waringMsg);
			common.showMsgOnWindow(common.ENUM_WINMSG_LEVEL.WARNING, waringMsg);
		}

	};

	var downloadTizenCertfile = async function () {
		logger.info(moduleName, 'downloadTizenCertfile start');
		let certGenFoler = 'https://download.tizen.org/sdk/tizenstudio/official/binary/';
		let certGenName = 'certificate-generator_0.1.2_windows-64.zip';
		if (process.platform == 'linux') {
			certGenName = 'certificate-generator_0.1.2_ubuntu-64.zip';
		} else if (process.platform == 'mac') {
			certGenName = 'certificate-generator_0.1.2_macos-64.zip';
		}
		if (!fs.existsSync(certPath)) {
			logger.info(moduleName, 'create dir:' + certPath);
			fs.mkdirSync(certPath);
		}

		let streamFile = fs.createWriteStream(certZipFile);
		logger.info(moduleName, 'requet to download ' + certGenFoler + certGenName);
		request(certGenFoler + certGenName).pipe(streamFile).on('close', () => {
			logger.info(moduleName, 'downloadTizenCertfile(): download certificate file successful');
			unzipTizenCertifile();
		});
	}

	var unzipTizenCertifile = function () {
		logger.info(moduleName, 'unzipTizenCertifile start');
		compressing.zip.uncompress(certZipFile, certPath).then(() => {
			logger.info(moduleName, 'unzip ' + certZipFile + ' successful');
		}).catch((err) => {
			logger.error(moduleName, err);
		});
	}

	return {
		handleCommand:async function() {
			let tizenCertMgr = new TizenCM(common.resourcePath, common.developerCA, common.developerCAPriKeyPath);
			//tizenCertMgr.init();

			if (!fs.existsSync(common.developerCA)) {
				logger.info(moduleName, 'download tizen certifile');
				await downloadTizenCertfile();
			}

			tizenCertificateViewControl.showView().then((certInfo) => {
				let profileName = certInfo.profileInfo;
				let authorCA = common.developerCA;
				let authorCertPath = null;
				let authorPassword = null;
				let distributorCA = null;
				let distributorCertPath = null;
				let distributorPassword = null;
				let profileMgr = new ProfileManager(common.resourcePath);

				console.log(certInfo);

				try {
					// Handle author certificate information
					if (certInfo.authorInfo.type == 'create') {
						tizenCertMgr.createCert(
							certInfo.authorInfo.info.authorFile,
							certInfo.authorInfo.info.authorName,
							certInfo.authorInfo.info.authorPassword,
							certInfo.authorInfo.info.authorCountry,
							certInfo.authorInfo.info.authorState,
							certInfo.authorInfo.info.authorCity,
							certInfo.authorInfo.info.authorOrganization,
							certInfo.authorInfo.info.authorDepartment,
							certInfo.authorInfo.info.authorEmail
						);

						authorCertPath = common.AuthorPath + path.sep + certInfo.authorInfo.info.authorFile + '.p12';
						authorPassword = certInfo.authorInfo.info.authorPassword;
					}
					else if (certInfo.authorInfo.type == 'select') {
						authorCertPath = certInfo.authorInfo.info.authorFile;
						authorPassword = certInfo.authorInfo.info.authorPassowrd;
					}

					// Handle distributor certificate information
					if (certInfo.distributorInfo.type == 'default') {
						if (certInfo.distributorInfo.info == 'public') {
							distributorCA = common.distributorPublicCA;
							distributorCertPath = common.distributorPublicSigner;
						}
						else if (certInfo.distributorInfo.info == 'partner') {
							distributorCA = common.distributorPartnerCA;
							distributorCertPath = common.distributorPartnerSigner;
						}
						distributorPassword = distributorSignerPassword;
					}
					else if (certInfo.distributorInfo.type == 'select') {
						distributorCA = '';
						distributorCertPath = certInfo.distributorInfo.info.distributorFile;
						distributorPassword = certInfo.distributorInfo.info.distributorPassword;
					}

					profileMgr.registerProfile(profileName, authorCA, authorCertPath, authorPassword, distributorCA, distributorCertPath, distributorPassword);
					common.showMsgOnWindow(common.ENUM_WINMSG_LEVEL.INFO, 'Creating new profile successful.');

					dialog.showMessageBox({
						title: 'Tizen Certificate',
						buttons: ['OK'],
						message: 'The new certificate profile has been successfully created.',
						checkboxLabel: 'Set the new profile as active'
					}, function(response, checkboxChecked) {
						if (response == 0 && checkboxChecked == true) {
							profileMgr.setActivateProfile(profileName);
						}
					});
				} catch (ex) {
					common.showMsgOnWindow(common.ENUM_WINMSG_LEVEL.ERROR, 'Creating new profile failed.');
					if(ex.stack) {
						console.error(ex.stack);
					} else {
						console.error('Error', ex);
					}
				}
			});
		}
	};
})();
module.exports = tizenCertificate;
