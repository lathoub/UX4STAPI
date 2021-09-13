function validate(form){
    let username = document.getElementById('username').value;
    let password = document.getElementById('password').value;

    if(username==="admin" && password==="admin"){
        location.href= 'index.html';
        return false;
    }
    else {
        alert("Wrong credentials")
        form.username.focus();
    }
    return true;
}