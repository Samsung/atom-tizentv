'use babel';

//import AtomExtensionTizensdkView from './atom-extension-tizensdk-view';
import { CompositeDisposable } from 'atom';
var packageConfig = require('./package-config')
var createProject = require('./createProject');
var buildPackage = require('./buildPackage');
var certificateManager = require('./certificateManager');
var runApplication = require('./runApplication');
var openTerminal = require('./openTerminal');
var debugApplication = require('./debugApplication');

export default {

  config: packageConfig,
  //atomExtensionTizensdkView: null,
  //modalPanel: null,
  subscriptions: null,

  activate(state) {
    /*this.atomExtensionTizensdkView = new AtomExtensionTizensdkView(state.atomExtensionTizensdkViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.atomExtensionTizensdkView.getElement(),
      visible: false
    });*/

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'Tizen TV: Create Web Project': () => createProject.handleCommand(),
      'Tizen TV: Build Signed Package': () => buildPackage.handleCommand(),
      'Tizen TV: Launch Application': () => runApplication.handleCommand(),
      'Tizen TV: Debug Application': () => debugApplication.handleCommand(),
      'Tizen TV: Run Certificate Manager': () => certificateManager.handleCommand(),
      'Tizen TV: SDB Command Prompt': () => openTerminal.handleCommand()
    }));
  },

  deactivate() {
    //this.modalPanel.destroy();
    if (projectListView != null) {
      projectListView.destroy()
      projectListView = null
    }
    this.subscriptions.dispose();
    this.atomExtensionTizensdkView.destroy();
  },

  serialize() {
    /*return {
      atomExtensionTizensdkViewState: this.atomExtensionTizensdkView.serialize()
    };*/
  },

  toggle() {
    let launcher = require('./appLauncher');
    
    launcher.debugAppOnTV(`E:\\atomprj\\BasicProject2`);
  }

};
