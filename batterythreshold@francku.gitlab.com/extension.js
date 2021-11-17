/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */

const GETTEXT_DOMAIN = 'gnome-shell-extension-battery-threshold';

const { GObject, St, Clutter, Gio, GLib } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const _ = ExtensionUtils.gettext;

const ByteArray = imports.byteArray;

const threshold_command = "pkexec tee /sys/class/power_supply/BAT0/charge_control_end_threshold"

const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.Button {
        _init() {
            super._init(0.0, _('Battery Threshold Indicator'));

            this.get_threshold();

            let labelText = `Battery threshold: ${this.threshold}%`;

            this.textBox = new St.Label({
                text: labelText,
                y_align: Clutter.ActorAlign.CENTER
            })
            this.add_actor(this.textBox);

            let set_threshold_item_60 = new PopupMenu.PopupMenuItem(_('Set threshold to 60%'));
            set_threshold_item_60.connect('activate', () => {
                this.set_threshold("60")
            });

            let set_threshold_item_80 = new PopupMenu.PopupMenuItem(_('Set threshold to 80%'));
            set_threshold_item_80.connect('activate', () => {
                this.set_threshold("80")
            });

            let set_threshold_item_100 = new PopupMenu.PopupMenuItem(_('Set threshold to 100%'));
            set_threshold_item_100.connect('activate', () => {
                this.set_threshold("100")
            });

            let get_current_threshold_item = new PopupMenu.PopupMenuItem(_('Current threshold'));
            get_current_threshold_item.connect('activate', () => {
                this.get_threshold()
                Main.notify(_(`Current threshold: ${this.threshold}%`));
            });

            this.menu.addMenuItem(set_threshold_item_60);
            this.menu.addMenuItem(set_threshold_item_80);
            this.menu.addMenuItem(set_threshold_item_100);
            this.menu.addMenuItem(get_current_threshold_item);
        }

        set_threshold(new_threshold) {
            if (new_threshold !== this.threshold) {
                try {
                    let proc = Gio.Subprocess.new(
                        ['/bin/bash', '-c', `echo ${new_threshold} | ${threshold_command}`],
                        Gio.SubprocessFlags.STDERR_PIPE
                    );
                    proc.communicate_utf8_async(null, null, (proc, res) => {
                        try {
                            let [, , stderr] = proc.communicate_utf8_finish(res);
                            if (!proc.get_successful())
                                throw new Error(stderr);

                            this.get_threshold()
                            if (this.threshold == new_threshold) {
                                Main.notify(_(`Battery threshold set to ${this.threshold}%`));
                                this.textBox.set_text(`Battery threshold: ${this.threshold}%`);
                            }
                        } catch (e) {
                            logError(e);
                        }
                    });
                } catch (e) {
                    logError(e);
                }
            }
        }

        get_threshold() {
            let [, out, ,] = GLib.spawn_command_line_sync("cat /sys/class/power_supply/BAT0/charge_control_end_threshold");
            this.threshold = (ByteArray.toString(out)).trim();
        }

    });

class Extension {
    constructor(uuid) {
        this._uuid = uuid;

        ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
    }

    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this._uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}

function init(meta) {
    return new Extension(meta.uuid);
}
