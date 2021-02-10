var createProjectViewControl = (function () {
    const { CompositeDisposable } = require('atom');
    const { dialog } = require('electron').remote;
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const Q = require('q');
    var common = require('./common');
    var WorkspaceSettingView = require('./views/workspaceSettingView');
    var ProjectSettingsView = require('./views/projectSettingView');
    const SelectListView = require('atom-select-list');

    var projectSettingView = null;
    var projectSettingPanel = null;
    var workspaceSettingView = null;
    var workspaceSettingPanel = null;

    var templateSelectView = null;
    var templateSelectPanel = null;

    var currentView = null;
    var isSwitchingPage = false;

    var workspacePath = null;
    var workspaceDefault = false;

    var projectName = null;
    var templatePath = null;

    var systemPlatform = os.platform();
    var deferred = null;
    var disposables = null;

    var settingProjectProperties = function (templateType) {
        // Set default project name according to template type
        switch (templateType) {
            case 'Basic Project':
                projectName = 'BasicProject';
                templatePath =
                    common.extensionRootPath +
                    '/templates/Basic/Tizen_Blank/project'
                        .split('/')
                        .join(path.sep);
                break;
            case 'Caph-Empty Template for AngularJS':
                projectName = 'CaphEmptyTemplateforAngularJS';
                templatePath =
                    common.extensionRootPath +
                    '/templates/Caph/Empty_AngularJS/project'
                        .split('/')
                        .join(path.sep);
                break;
            case 'Caph-Empty Template for jQuery':
                projectName = 'CaphEmptyTemplateforjQuery';
                templatePath =
                    common.extensionRootPath +
                    '/templates/Caph/Empty_jQuery/project'
                        .split('/')
                        .join(path.sep);
                break;
            case 'Empty':
                projectName = 'Empty';
                templatePath =
                    common.extensionRootPath +
                    '/templates/Basic/Empty/project'.split('/').join(path.sep);
                break;
            case 'jQuery Navigation':
                projectName = 'jQueryNavigation';
                templatePath =
                    common.extensionRootPath +
                    '/templates/jQuery Mobile/NavigationView/project'
                        .split('/')
                        .join(path.sep);
                break;
        }

        // Check if there is valid workspace loaction setting
        workspacePath = atom.config.get(
            'atom-tizentv.tizentv.workspaceSetting.directory'
        );
        workspaceDefault = atom.config.get(
            'atom-tizentv.tizentv.workspaceSetting.setAsDefault'
        );
        if (
            fs.existsSync(workspacePath) &&
            workspaceDefault == true &&
            workspaceSettingPanel == null
        ) {
            // render project properties page
            if (projectSettingPanel == null) {
                createProjectSettingPanel();
            } else {
                currentView = 'project';
                verifyDefaultProjectName();
                projectSettingView.update({
                    nameInputValue: projectName
                });
                projectSettingPanel.show();
            }
        } else {
            // render workspace path config page
            if (workspaceSettingPanel == null) {
                createWorkspaceSettingPanel();
            } else {
                workspaceSettingPanel.show();
            }
        }
    };

    var createWorkspaceSettingPanel = function () {
        currentView = 'workspace';
        workspaceSettingView = new WorkspaceSettingView({
            pathInputValue: workspacePath,
            onClickBackBtn: () => switchPageBack(),
            onClickNextBtn: () => switchPageNext(),
            onClickCancelBtn: () => workspaceSettingPanel.hide(),
            onClickBrowseBtn: () => selectWorkpathPath()
        });
        workspaceSettingPanel = atom.workspace.addModalPanel({
            item: workspaceSettingView.element
        });
        disposables.add(
            workspaceSettingPanel.onDidChangeVisible(visible => {
                if (visible == false) {
                    checkPanelStatus();
                }
            })
        );
    };

    var createProjectSettingPanel = function () {
        currentView = 'project';
        verifyDefaultProjectName();
        projectSettingView = new ProjectSettingsView({
            nameInputValue: projectName,
            pathInputValue: workspacePath,
            onClickBackBtn: () => switchPageBack(),
            onClickCancelBtn: () => projectSettingPanel.hide(),
            onClickBrowseBtn: () => selectWorkpathPath(),
            onClickFinishBtn: (name, location) =>
                finishProjectSettings(name, location)
        });
        projectSettingPanel = atom.workspace.addModalPanel({
            item: projectSettingView.element
        });
        disposables.add(
            projectSettingPanel.onDidChangeVisible(visible => {
                if (visible == false) {
                    checkPanelStatus();
                }
            })
        );
    };

    var checkPanelStatus = function () {
        if (isSwitchingPage == true) {
            return;
        }

        if (projectSettingPanel != null) {
            if (projectSettingPanel.isVisible() == true) {
                return;
            }
        }

        if (templateSelectPanel != null) {
            if (templateSelectPanel.isVisible() == true) {
                return;
            }
        }

        if (workspaceSettingPanel != null) {
            if (workspaceSettingPanel.isVisible() == true) {
                return;
            }
        }

        destroyAllPanel();
    };

    var switchPageNext = function () {
        isSwitchingPage = true;

        // Check the workspace path
        let pathValue = workspaceSettingView.getPathInputValue();
        let pathCheck = checkDirectoryInput(pathValue);
        if (pathCheck != 'success') {
            workspaceSettingView.update({
                pathInputTips: pathCheck
            });
        } else {
            // If workspace does not exist, ask if make the dir or not
            if (!fs.existsSync(pathValue)) {
                let createIndex = dialog.showMessageBox({
                    type: 'info',
                    buttons: ['Yes', 'Cancel'],
                    message:
                        'The entered directory does not exist, do you want to create it?'
                });

                if (createIndex == 0) {
                    common.makeFilePath(pathValue);
                } else {
                    isSwitchingPage = false;
                    return;
                }
            }
            workspacePath = pathValue;
            workspaceDefault = workspaceSettingView.getSetDefaultValue();
            atom.config.set(
                'atom-tizentv.tizentv.workspaceSetting.directory',
                workspacePath
            );
            atom.config.set(
                'atom-tizentv.tizentv.workspaceSetting.setAsDefault',
                workspaceDefault
            );
            if (projectSettingPanel == null) {
                createProjectSettingPanel();
            } else {
                currentView = 'project';
                verifyDefaultProjectName();
                projectSettingView.update({
                    nameInputValue: projectName
                });
                projectSettingPanel.show();
            }
        }
        isSwitchingPage = false;
    };

    var switchPageBack = function () {
        isSwitchingPage = true;
        if (currentView == 'workspace') {
            currentView = 'template';
            templateSelectPanel.show();
            templateSelectView.focus();
        } else if (currentView == 'project') {
            if (workspaceSettingPanel != null) {
                currentView = 'workspace';
                workspaceSettingPanel.show();
            } else {
                currentView = 'template';
                templateSelectPanel.show();
                templateSelectView.focus();
            }
        }
        isSwitchingPage = false;
    };

    var destroyAllPanel = function () {
        currentView = null;

        if (templateSelectPanel) {
            templateSelectPanel.destroy();
            templateSelectPanel = null;
        }

        if (projectSettingPanel) {
            projectSettingPanel.destroy();
            projectSettingPanel = null;
        }

        if (workspaceSettingPanel) {
            workspaceSettingPanel.destroy();
            workspaceSettingPanel = null;
        }

        if (disposables) {
            disposables.dispose();
            disposables = null;
        }
    };

    var selectWorkpathPath = function () {
        dialog.showOpenDialog(
            {
                title: 'Choose workspace directory',
                properties: ['openDirectory', 'showHiddenFiles']
            },
            filePaths => {
                if (filePaths) {
                    if (currentView == 'workspace') {
                        // Update workspace setting view, fill the input box with path selected
                        workspacePath = filePaths[0];
                        atom.config.set(
                            'atom-tizentv.tizentv.workspaceSetting.directory',
                            workspacePath
                        );
                        workspaceSettingView.update({
                            pathInputValue: workspacePath,
                            nextBtnDisabled: false
                        });
                    } else if (currentView == 'project') {
                        // Update location input
                        projectSettingView.update({
                            pathInputValue: filePaths[0]
                        });
                    }
                }
            }
        );
    };

    var checkDirectoryInput = function (pathValue) {
        if (pathValue == '') {
            return 'The directory must be specified';
        }

        if (systemPlatform == 'win32') {
            //let pathMatch = pathValue.match(/^[a-zA-Z]:(\\[a-zA-Z_0-9\.\' \']+)*\\?/g);
            let pathMatch = pathValue.match(
                /^[a-zA-Z]:(\\[^\\^\/^:^\*^\?^\"^<^>^|]+)*\\?/g
            );
            if (pathMatch != null) {
                if (pathMatch.length == 1 && pathMatch[0] == pathValue) {
                    return 'success';
                }
            }

            return 'Please check the directory format, and make sure invalid characters \\/:*?"<>| are not included.';
        } else {
            let pathMatch = pathValue.match(/^\/([^\/]+\/?)*/g);
            if (pathMatch != null) {
                if (pathMatch.length == 1 && pathMatch[0] == pathValue) {
                    return 'success';
                }
            }

            return 'Please check the directory format.';
        }
    };

    var checkProjectName = function (name) {
        if (name == '') {
            return 'The project name must be specified';
        }

        let nameMatch = name.match('[a-zA-Z0-9]+');
        if (nameMatch != null) {
            if (nameMatch.length == 1 && nameMatch[0] == name) {
                return 'success';
            }
        }

        return 'Use only alphabetic and numeric characters.';
    };

    /*
        If ProjectName exist, modify it as ProjectName1
    */
    var verifyDefaultProjectName = function () {
        let index = 0;
        let tmpPath = workspacePath + path.sep + projectName;

        if (fs.existsSync(tmpPath)) {
            do {
                index = index + 1;
                tmpPath = tmpPath + index.toString();
            } while (fs.existsSync(tmpPath));
        }

        if (index != 0) {
            projectName = projectName + index.toString();
        }
    };

    var finishProjectSettings = function (name, location) {
        let pathCheck = checkDirectoryInput(location);
        let nameCheck = checkProjectName(name);
        if (pathCheck != 'success' || nameCheck != 'success') {
            projectSettingView.update({
                pathInputTips: pathCheck.replace('success', ''),
                nameInputTips: nameCheck.replace('success', '')
            });

            return;
        }

        if (fs.existsSync(location + path.sep + name)) {
            projectSettingView.update({
                nameInputTips: 'Project "' + name + '" already exist.'
            });

            return;
        }

        if (!fs.existsSync(location)) {
            let createIndex = dialog.showMessageBox({
                type: 'info',
                buttons: ['Yes', 'Cancel'],
                message:
                    'The entered directory does not exist, do you want to create it?'
            });

            if (createIndex == 0) {
                common.makeFilePath(location);
            } else {
                return;
            }
        }

        projectSettingPanel.hide();

        // start to create the new project, create a status indicate view here maybe ???
        deferred.resolve([location + path.sep + name, templatePath]);
    };

    return {
        showView: function () {
            deferred = Q.defer();

            let templateItems = [
                'Basic Project',
                'Caph-Empty Template for AngularJS',
                'Caph-Empty Template for jQuery',
                'Empty',
                'jQuery Navigation'
            ];

            templateSelectView = new SelectListView({
                items: templateItems,
                elementForItem: item => {
                    const li = document.createElement('li');
                    li.textContent = item;
                    return li;
                },
                didConfirmSelection: item => {
                    isSwitchingPage = true;
                    settingProjectProperties(item);
                    isSwitchingPage = false;
                },
                didCancelSelection: () => {
                    templateSelectPanel.hide();
                }
            });

            currentView = 'template';
            templateSelectPanel = atom.workspace.addModalPanel({
                item: templateSelectView.element
            });
            templateSelectView.focus();

            disposables = new CompositeDisposable();
            disposables.add(
                templateSelectPanel.onDidChangeVisible(visible => {
                    if (visible == false) {
                        checkPanelStatus();
                    }
                })
            );

            return deferred.promise;
        }
    };
})();
module.exports = createProjectViewControl;
