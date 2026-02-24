import { App, Modal } from 'obsidian';

export class ConfirmModal extends Modal {
  private message: string;
  private confirmText: string;
  private onConfirm: () => void | Promise<void>;
  private isDangerous: boolean;

  constructor(
    app: App,
    message: string,
    onConfirm: () => void | Promise<void>,
    confirmText = 'Delete',
    isDangerous = true,
  ) {
    super(app);
    this.message = message;
    this.onConfirm = onConfirm;
    this.confirmText = confirmText;
    this.isDangerous = isDangerous;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('hf-confirm-modal');

    contentEl.createEl('h3', { text: 'Confirm Action' });
    contentEl.createEl('p', { text: this.message, cls: 'hf-confirm-message' });

    const btnRow = contentEl.createDiv({ cls: 'hf-modal-buttons' });

    const cancelBtn = btnRow.createEl('button', { text: 'Cancel', cls: 'hf-btn' });
    cancelBtn.addEventListener('click', () => this.close());

    const confirmBtn = btnRow.createEl('button', {
      text: this.confirmText,
      cls: this.isDangerous ? 'hf-btn hf-btn-danger' : 'hf-btn hf-btn-primary',
    });
    confirmBtn.addEventListener('click', async () => {
      this.close();
      await this.onConfirm();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}
