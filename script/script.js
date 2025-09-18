const fileUpload = document.getElementById('file-upload');
const fileNameDisplay = document.getElementById('file-name');

const modalContainer = document.getElementById('modal-container');
const btnAceptar = document.getElementById('btn-aceptar');
const btnDenegar = document.getElementById('btn-denegar');

fileUpload.addEventListener('change', function() {
    if (fileUpload.files.length > 0) {
        fileNameDisplay.textContent = `Archivo seleccionado: ${fileUpload.files[0].name}`;
        mostrarModal();
    }
});

btnAceptar.addEventListener('click', function() {
    const file = fileUpload.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(event) {
        const fileContent = event.target.result;
        const modifiedFileContent = preprocessCSVData(fileContent);
        localStorage.setItem('csvData', modifiedFileContent);
        localStorage.setItem('csvFileName', file.name);

        window.location.href = 'tabla.html';
    };

    reader.readAsText(file);
    ocultarModal();
});

btnDenegar.addEventListener('click', function() {
    fileUpload.value = ''; 
    fileNameDisplay.textContent = ''; 
    ocultarModal();
    
    console.log("Usuario denegó el permiso. Carga cancelada.");
});

function mostrarModal() {
    modalContainer.classList.add('visible');
}

function ocultarModal() {
    modalContainer.classList.remove('visible');
}