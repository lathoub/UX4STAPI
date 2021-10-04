const loggedOutLinks = document.querySelectorAll('.logged-out');
const loggedInLinks = document.querySelectorAll('.logged-in');
const accountDetails = document.querySelector('.account-details')

// Toggle UI elements depending on login status
const setupUI = (user) =>{
    if(user){
        const html = `
            <div>${user.email}</div>
        `;
        accountDetails.innerHTML = html;
        document.getElementById("overlay").style.display = "none";
        loggedInLinks.forEach(item => item.style.display= 'block');
        loggedOutLinks.forEach(item => item.style.display= 'none')
    } else {
        accountDetails.innerHTML = '';
        document.getElementById("overlay").style.display = "block";
        loggedInLinks.forEach(item => item.style.display= 'none');
        loggedOutLinks.forEach(item => item.style.display= 'block')
    }
}

// Listen to auth status changes
auth.onAuthStateChanged(user => {
    if (user) {
        user.getIdTokenResult().then(idTokenResult =>{
            console.log(idTokenResult.claims.admin);
        })
        setupUI(user);
        console.log("User logged in: ", user)
    } else {
        console.log("User logged out")
        setupUI();
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








