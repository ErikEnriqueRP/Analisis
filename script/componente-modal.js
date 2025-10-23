function showCustomAlert({ title, message, type = 'alert', inputPlaceholder = '', inputValue = '' }) {
    return new Promise((resolve, reject) => {
        const modal = document.getElementById('custom-modal');
        const modalTitle = document.getElementById('custom-modal-title');
        const modalMessage = document.getElementById('custom-modal-message');
        const confirmBtn = document.getElementById('custom-modal-confirm');
        const cancelBtn = document.getElementById('custom-modal-cancel');
        const inputGroup = document.getElementById('custom-modal-input-group');
        const inputField = document.getElementById('custom-modal-input');

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        inputField.value = inputValue;
        inputField.placeholder = inputPlaceholder || '';
        inputGroup.style.display = type === 'prompt' ? 'block' : 'none';
        cancelBtn.style.display = type !== 'alert' ? 'inline-block' : 'none';

        modal.style.display = 'flex';

        const onConfirm = () => {
            modal.style.display = 'none';
            cleanup();
            resolve(type === 'prompt' ? inputField.value.trim() : true);
        };

        const onCancel = () => {
            modal.style.display = 'none';
            cleanup();
            reject();
        };

        const onKeyup = (e) => {
            if (e.key === 'Enter') onConfirm();
        };

        function cleanup() {
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            inputField.removeEventListener('keyup', onKeyup);
        }

        confirmBtn.addEventListener('click', onConfirm, { once: true });
        cancelBtn.addEventListener('click', onCancel, { once: true });
        if (type === 'prompt') {
            inputField.addEventListener('keyup', onKeyup);
            setTimeout(() => inputField.focus(), 50);
        }
    });
}