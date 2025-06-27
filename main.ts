import { App, Plugin, PluginSettingTab, Setting, TFile, TFolder, Notice } from 'obsidian';

interface CleanNotesSettings {
  dailyNotesFolder: string;
  daysAfter: number;
  removeButtons: boolean;
  removeTaskQueries: boolean;
  removeEmptySections: boolean;
}

const DEFAULT_SETTINGS: CleanNotesSettings = {
  dailyNotesFolder: '',
  daysAfter: 7,
  removeButtons: true,
  removeTaskQueries: true,
  removeEmptySections: true,
};

export default class CleanNotesPlugin extends Plugin {
  settings: CleanNotesSettings;

  async onload() {
    await this.loadSettings();
    if (!this.settings.dailyNotesFolder) {
      const folder = this.getDefaultDailyNotesFolder();
      if (folder) this.settings.dailyNotesFolder = folder;
    }

    this.addCommand({
      id: 'clean-old-daily-notes',
      name: 'Clean old daily notes',
      callback: () => this.cleanNotes(),
    });

    this.addSettingTab(new CleanNotesSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.cleanNotes();
      this.registerInterval(
        window.setInterval(() => this.cleanNotes(), 24 * 60 * 60 * 1000),
      );
    });
  }

  async cleanNotes() {
    const folderPath = this.settings.dailyNotesFolder || this.getDefaultDailyNotesFolder();
    if (!folderPath) {
      new Notice('Daily notes folder not set');
      return;
    }
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!(folder instanceof TFolder)) {
      new Notice(`Folder not found: ${folderPath}`);
      return;
    }
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === 'md') {
        if (!this.isOldEnough(child.basename)) continue;
        const original = await this.app.vault.read(child);
        const cleaned = this.applyTransforms(original);
        if (original !== cleaned) {
          await this.app.vault.modify(child, cleaned);
        }
      }
    }
    new Notice('Finished cleaning daily notes');
  }

  isOldEnough(basename: string): boolean {
    const match = basename.match(/(\d{4}-\d{2}-\d{2})/);
    if (!match) return false;
    const fileDate = new Date(match[1]);
    if (isNaN(fileDate.getTime())) return false;
    const now = new Date();
    const diff = (now.getTime() - fileDate.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= this.settings.daysAfter;
  }

  applyTransforms(text: string): string {
    let out = text;
    if (this.settings.removeButtons) {
      out = out.replace(/```button[\s\S]*?```/g, '');
    }
    if (this.settings.removeTaskQueries) {
      out = out.replace(/```tasks[\s\S]*?```/g, '');
    }
    if (this.settings.removeEmptySections) {
      out = this.removeEmptySections(out);
    }
    return out.trim() + '\n';
  }

  removeEmptySections(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^#+\s/.test(line)) {
        let j = i + 1;
        let hasContent = false;
        while (j < lines.length && !/^#+\s/.test(lines[j])) {
          if (lines[j].trim() !== '') {
            hasContent = true;
          }
          j++;
        }
        if (!hasContent) {
          i = j - 1;
          continue;
        }
      }
      result.push(line);
    }
    return result.join('\n');
  }

  getDefaultDailyNotesFolder(): string {
    // try to read daily-notes core plugin settings
    const daily = (this.app as any).internalPlugins?.getPluginById('daily-notes');
    const opts = daily?.instance?.options;
    return opts?.folder || '';
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class CleanNotesSettingTab extends PluginSettingTab {
  plugin: CleanNotesPlugin;
  constructor(app: App, plugin: CleanNotesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Daily notes folder')
      .setDesc('Path to the folder containing your daily notes')
      .addText(text =>
        text
          .setPlaceholder('Folder')
          .setValue(this.plugin.settings.dailyNotesFolder)
          .onChange(async value => {
            this.plugin.settings.dailyNotesFolder = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Days after to clean')
      .setDesc('Clean notes older than this many days')
      .addText(text =>
        text
          .setPlaceholder('7')
          .setValue(String(this.plugin.settings.daysAfter))
          .onChange(async value => {
            const num = parseInt(value, 10);
            if (!isNaN(num)) {
              this.plugin.settings.daysAfter = num;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName('Remove button blocks')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.removeButtons).onChange(async value => {
          this.plugin.settings.removeButtons = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Remove tasks queries')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.removeTaskQueries).onChange(async value => {
          this.plugin.settings.removeTaskQueries = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Remove empty sections')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.removeEmptySections).onChange(async value => {
          this.plugin.settings.removeEmptySections = value;
          await this.plugin.saveSettings();
        }),
      );
  }
}
