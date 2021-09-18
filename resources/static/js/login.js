function toggleResetPswd(e) {
    e.preventDefault();
    $('#logreg-forms .form-signin').toggle() // display:block or none
    $('#logreg-forms .form-reset').toggle() // display:block or none
}

function toggleSignUp(e) {
    e.preventDefault();
    $('#logreg-forms .form-signin').toggle(); // display:block or none
}

$(() => {
    // Login Register Form
    $('#logreg-forms #forgot_pswd').click(toggleResetPswd);
    $('#logreg-forms #cancel_reset').click(toggleResetPswd);
})

// Listen to auth status changes
    auth.onAuthStateChanged(user =>{
        if (user){
            console.log("User logged in: ", user)
        } else {
            location.href = 'login.html';
            console.log("User logged out")
        }
    })

// Sign up
$('#btn-signupForm').click(function () {
    $('#modal-signup').modal('hide');
})
const signupForm = document.querySelector('#signup-form');
signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // get user info
    const email = signupForm['signupEmail'].value;
    const password = signupForm['signupPassword'].value;

    console.log(email, password);
    // sign up the user
    auth.createUserWithEmailAndPassword(email, password).then(cred => {
    })
    signupForm.reset();
});

// Sign in
const loginForm = document.querySelector('#signInForm');
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // Get user info
    const email = loginForm['inputUsername'].value;
    const password = loginForm['inputPassword'].value;

    auth.signInWithEmailAndPassword(email, password).then(cred => {
        console.log(cred.user);
        location.href = 'index.html';
    })
    loginForm.reset();
});

// Sign out
const logout = document.querySelector('#logout');
logout.addEventListener('click', (e) => {
    e.preventDefault();
    auth.signOut().then(() => {
        console.log("logged out")
    })
    location.href = 'login.html';
})







