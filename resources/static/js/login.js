function toggleResetPswd(e) {
    e.preventDefault();
    $('#logreg-forms .form-signin').toggle() // display:block or none
    $('#logreg-forms .form-reset').toggle() // display:block or none
}

function toggleSignUp(e) {
    e.preventDefault();
}

$(() => {
    // Login Register Form
    $('#logreg-forms #forgot_pswd').click(toggleResetPswd);
    $('#logreg-forms #cancel_reset').click(toggleResetPswd);
})

const accountDetails = document.querySelector('.account-details');

const setupAccount = (user) => {
    if (user) {
        // const html = ''
        //     + '<div>' + user.email + '</div>';
        // accountDetails.innerHTML = html;
    } else {
        accountDetails.innerHTML = '';
    }
}

// Listen to auth status changes
auth.onAuthStateChanged(user => {
    if (user) {
        setupAccount(user);
        console.log("User logged in: ", user)
    } else {
        console.log("User logged out")
        setupAccount();
    }
})


// Sign up

const signupForm = document.querySelector('#signup-form');
signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // get user info
    const email = signupForm['signupEmail'].value;
    const password = signupForm['signupPassword'].value;

    // sign up the user
    auth.createUserWithEmailAndPassword(email, password).then(() => {
        signupForm.querySelector('.error').innerHTML = '';
        $('#modal-signup').modal('hide');
        signupForm.reset();
    }).catch(err => {
        signupForm.querySelector('.error').innerHTML = err.message;
    })
});

// Sign in
const loginForm = document.querySelector('#signin-form');
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // Get user info
    const email = loginForm['inputUsername'].value;
    const password = loginForm['inputPassword'].value;

    auth.signInWithEmailAndPassword(email, password).then(cred => {
        $('#modal-signin').modal('hide');
        signupForm.reset();
        loginForm.reset();
    }).catch(err => {
        loginForm.querySelector('.error').innerHTML = err.message;
    });
});

// Sign out
const logout = document.querySelector('#logout');
logout.addEventListener('click', (e) => {
    e.preventDefault();
    auth.signOut().then(() => {
        console.log("signed out")
    })
})








